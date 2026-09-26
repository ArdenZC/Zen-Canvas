// Qualification orchestration only. The existing manifest/tests own workloads
// and thresholds; retain failures even when a later independent observation passes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { PERFORMANCE_SUITES } from './performanceManifest.mjs';
import { createPerformanceFixtureIdentity } from './performanceFixtureIdentity.mjs';
import { manifestTargetPath, validateBinaryManifest } from './performanceArtifactManifest.mjs';

const root = process.cwd();
const output = path.resolve('.performance-artifacts/qualification');
const suites = ['search', 'library-content', 'workspace-foundation', 'preview-platform'];
const owned = ['.performance-artifacts/binaries', '.tmp-performance-fixtures', '.performance-temp', '.performance-cache', '.tmp-tests'];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const evidence = { sourceHead: git('rev-parse', 'HEAD'), sourceTree: git('rev-parse', 'HEAD^{tree}'),
  runner: { os: os.platform(), release: os.release(), architecture: os.arch() },
  runs: [], managedScan: [], classification: 'UNVERIFIED', cleanup: {} };

async function run(id, executable, args, env = process.env) {
  const record = { id, executable, args, started: new Date().toISOString(), metrics: [] };
  evidence.runs.push(record);
  const log = fs.createWriteStream(path.join(output, `${id}.log`));
  let raw = '';
  const child = spawn(executable, args, { cwd: root, env, windowsHide: true });
  const deadline = setTimeout(() => { record.timeout = true; child.kill(); }, 45 * 60 * 1000);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    log.write(chunk); process.stdout.write(chunk); raw += chunk.toString();
  });
  record.exitCode = await new Promise(resolve => {
    child.on('error', error => { record.error = error.message; resolve(-1); });
    child.on('close', code => resolve(code ?? -1));
  });
  clearTimeout(deadline);
  await new Promise(resolve => log.end(resolve));
  record.finished = new Date().toISOString();
  record.metrics = [...raw.matchAll(/\[zc-perf\] (\{[^\r\n]+\})/g)].map(match => JSON.parse(match[1]));
  return record;
}

const node = (id, script, args = []) => run(id, process.execPath, [`scripts/${script}`, ...args]);
let ownsRoots = false;
try {
  if (evidence.sourceHead !== process.env.EXPECTED_SOURCE_SHA) throw new Error('exact source SHA mismatch');
  if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('tracked tree is dirty');
  for (const relative of owned) if (fs.existsSync(relative)) throw new Error(`refusing pre-existing qualification output: ${relative}`);
  fs.mkdirSync(output, { recursive: true });
  ownsRoots = true;
  fs.mkdirSync('.performance-temp', { recursive: true });
  process.env.TEMP = path.resolve('.performance-temp');
  process.env.TMP = process.env.TEMP;
  process.env.TMPDIR = process.env.TEMP;
  process.env.PERF_CHECKOUT_SHA = evidence.sourceHead;
  const selection = [`--suites=${suites.join(',')}`, '--profile=full'];
  const prepare = await node('prepare-binaries', 'preparePerformanceBinaries.mjs', [...selection, '--output=.performance-artifacts/binaries']);
  if (prepare.exitCode !== 0) throw new Error('performance binary preparation failed');
  const fixture = await node('prepare-fixtures', 'preparePerformanceFixtures.mjs', [...selection, '--prepared-binaries=.performance-artifacts/binaries', '--cache-root=.tmp-performance-fixtures/cache']);
  if (fixture.exitCode !== 0) throw new Error('performance fixture preparation failed');
  const fixtureIdentity = createPerformanceFixtureIdentity({ profile: 'full' }).fixtureIdentity;
  for (const suite of suites) {
    await node(`suite-${suite}`, 'runPerformanceSuite.mjs', [`--suite=${suite}`, '--profile=full',
      `--prepared-binaries=.performance-artifacts/binaries/${suite}`,
      ...(suite === 'library-content' ? [`--fixture-root=.tmp-performance-fixtures/cache/${fixtureIdentity}`, `--fixture-identity=${fixtureIdentity}`] : [])]);
  }
  const binaryRoot = path.resolve('.performance-artifacts/binaries/workspace-foundation');
  const manifest = validateBinaryManifest(binaryRoot, { expectedCommit: evidence.sourceHead,
    expectedProfile: 'full', expectedSuites: ['workspace-foundation'], requiredTargets: ['lib'] });
  evidence.binaryManifest = manifest;
  const test = PERFORMANCE_SUITES['workspace-foundation'].extended.find(item => item.id === 'workspace_foundation_scheduler_pressure');
  for (let index = 1; index <= 3; index++) {
    const observation = await run(`managed-scan-${index}`, manifestTargetPath(binaryRoot, manifest, 'lib'),
      [test.testName, '--exact', '--ignored', '--nocapture', '--test-threads=1'],
      { ...process.env, ZC_PERF_SUITE: 'workspace-foundation', ZC_PERF_WORKSPACE_FIXTURE_ROOT: path.resolve('.tmp-performance-fixtures/qualification-pressure') });
    const latency = observation.metrics.find(metric => metric.scenario === 'managed_scan_foreground_latency');
    const structural = observation.metrics.find(metric => metric.scenario === 'managed_scan_pressure');
    evidence.managedScan.push({ observation: index, latency, structural,
      ratio: latency ? latency.pressure_first_page_p95_us / latency.idle_first_page_p95_us : null,
      classification: observation.exitCode !== 0 || !latency || structural?.classification !== 'HARD PASS'
        ? 'BLOCKED' : latency.classification });
  }
  evidence.targetMisses = evidence.runs.flatMap(record => record.metrics.filter(metric => metric.classification === 'TARGET MISSED').map(metric => ({ run: record.id, ...metric })));
  evidence.classification = evidence.runs.some(record => record.exitCode !== 0) || evidence.managedScan.some(row => row.classification === 'BLOCKED')
    ? 'BLOCKED' : evidence.targetMisses.length ? 'PERFORMANCE REVIEW REQUIRED' : 'BACKEND QUALIFICATION COMPLETE';
} catch (error) {
  evidence.failure = error.stack;
  evidence.classification = 'BLOCKED';
} finally {
  if (ownsRoots) for (const relative of owned) {
    const absolute = path.resolve(relative);
    try {
      if (!absolute.startsWith(root + path.sep)) throw new Error('cleanup escapes workspace');
      fs.rmSync(absolute, { recursive: true, force: true });
      evidence.cleanup[relative] = !fs.existsSync(absolute);
    } catch (error) {
      evidence.cleanup[relative] = error.message;
      evidence.classification = 'BLOCKED';
    }
  }
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'interactive.json'), JSON.stringify(evidence, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'interactive.md'), `${evidence.classification}\n\nSource ${evidence.sourceHead}\n\n${JSON.stringify(evidence.managedScan, null, 2)}\n\nAll raw output and every TARGET MISS are retained in sibling logs/JSON. Browser/native UI timing remains separate.\n`);
}
process.exitCode = evidence.classification === 'BACKEND QUALIFICATION COMPLETE' ? 0 : 1;
