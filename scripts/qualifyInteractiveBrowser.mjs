import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const output = '.performance-artifacts/qualification';
const repeatCount = 5;
const expectedPreviewObservationsPerRun = 18;
const expectedBrowseObservationsPerRun = 2;
const expectedRawTimingSamples = 20;
if (fs.existsSync('.tmp-tests')) throw new Error('refusing pre-existing browser task data');
fs.mkdirSync(output, { recursive: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== process.env.EXPECTED_SOURCE_SHA) throw new Error('source mismatch');
const baseEnv = { ...process.env, W310_SOURCE_HEAD: head, W310_EXPECTED_CHECKOUT_SHA: head,
  W211_SOURCE_HEAD: head, W211_EXPECTED_CHECKOUT_SHA: head };
const result = { sourceHead: head, repeatCount, classification: 'UNVERIFIED', runs: [],
  previewObservations: [], browseObservations: [], targetMisses: [],
  limitations: ['Browser mock measures DOM timing; native/system useful representation is separate.',
    'Browse DOM timing uses the existing browser mock; real filesystem first page is measured separately by Workspace Foundation.'] };

function runScript(runIndex, script, env, logPath) {
  const observation = spawnSync(process.execPath, [`scripts/${script}`], { env, encoding: 'utf8', windowsHide: true,
    timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(logPath, (observation.stdout ?? '') + (observation.stderr ?? ''));
  result.runs.push({ runIndex, script, exitCode: observation.status, error: observation.error?.message,
    log: path.relative(output, logPath).replaceAll('\\', '/') });
  return observation.status === 0;
}

for (let runIndex = 1; runIndex <= repeatCount; runIndex += 1) {
  const previewStart = result.previewObservations.length;
  const browseStart = result.browseObservations.length;
  const runDir = path.join(output, 'browser-repeat', `run-${String(runIndex).padStart(2, '0')}`);
  fs.mkdirSync(runDir, { recursive: true });
  const previewPath = path.join(runDir, 'preview-browser.json');
  const browsePath = path.join(runDir, 'browse-browser.json');
  const env = { ...baseEnv, ZC_QUALIFICATION_OUTPUT: previewPath, ZC_BROWSE_QUALIFICATION_OUTPUT: browsePath };
  runScript(runIndex, 'runW3-10PhaseABrowserHarness.mjs', env,
    path.join(runDir, 'runW3-10PhaseABrowserHarness.log'));
  runScript(runIndex, 'runW2-11BrowserGate.mjs', env,
    path.join(runDir, 'runW2-11BrowserGate.log'));

  if (fs.existsSync(previewPath)) {
    const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
    for (const viewportEvidence of preview.evidence ?? []) {
      for (const scenario of viewportEvidence.evidence ?? []) {
        if (![scenario.shell?.p95Ms, scenario.shell?.targetP95Ms,
          scenario.useful?.p95Ms, scenario.useful?.targetP95Ms].every(Number.isFinite)
          || !Array.isArray(scenario.shellSamples) || scenario.shellSamples.length !== expectedRawTimingSamples
          || !Array.isArray(scenario.usefulSamples) || scenario.usefulSamples.length !== expectedRawTimingSamples) {
          result.runs.push({ runIndex, script: 'preview metrics', exitCode: -1,
            error: `incomplete Preview timing or raw samples for ${scenario.label}` });
          continue;
        }
        const shellMiss = scenario.shell.p95Ms > scenario.shell.targetP95Ms;
        const usefulMiss = scenario.useful.p95Ms > scenario.useful.targetP95Ms;
        const targetClassification = shellMiss || usefulMiss ? 'TARGET MISSED' : 'TARGET MET';
        const row = {
          runIndex,
          scenario: scenario.label,
          viewport: viewportEvidence.viewport,
          shellRawSamples: scenario.shellSamples ?? [],
          usefulRawSamples: scenario.usefulSamples ?? [],
          shellP95Ms: scenario.shell.p95Ms,
          usefulP95Ms: scenario.useful.p95Ms,
          shellTargetP95Ms: scenario.shell.targetP95Ms,
          usefulTargetP95Ms: scenario.useful.targetP95Ms,
          shellTargetClassification: shellMiss ? 'TARGET MISSED' : 'TARGET MET',
          usefulTargetClassification: usefulMiss ? 'TARGET MISSED' : 'TARGET MET',
          targetClassification,
        };
        result.previewObservations.push(row);
        if (targetClassification === 'TARGET MISSED') result.targetMisses.push(row);
      }
    }
  } else {
    result.runs.push({ runIndex, script: 'preview result', exitCode: -1,
      error: 'missing Preview result file' });
  }

  if (fs.existsSync(browsePath)) {
    const browse = JSON.parse(fs.readFileSync(browsePath, 'utf8'));
    for (const row of browse.evidence ?? []) {
      if (![row.feedbackP95Ms, row.feedbackTargetP95Ms, row.usefulP95Ms, row.usefulTargetP95Ms].every(Number.isFinite)
        || !Array.isArray(row.samples) || row.samples.length !== expectedRawTimingSamples) {
        result.runs.push({ runIndex, script: 'browse metrics', exitCode: -1,
          error: `incomplete Browse timing or raw samples for ${JSON.stringify(row.viewport)}` });
        continue;
      }
      const missed = row.feedbackP95Ms > row.feedbackTargetP95Ms || row.usefulP95Ms > row.usefulTargetP95Ms;
      const observation = { runIndex, ...row,
        targetClassification: missed ? 'TARGET MISSED' : 'TARGET MET' };
      result.browseObservations.push(observation);
      if (missed) result.targetMisses.push({ scenario: 'browse-transition', ...observation });
    }
  } else {
    result.runs.push({ runIndex, script: 'browse result', exitCode: -1,
      error: 'missing Browse result file' });
  }

  const previewCount = result.previewObservations.length - previewStart;
  if (previewCount !== expectedPreviewObservationsPerRun) {
    result.runs.push({ runIndex, script: 'preview completeness', exitCode: -1,
      error: `expected ${expectedPreviewObservationsPerRun} Preview observations, got ${previewCount}` });
  }
  const browseCount = result.browseObservations.length - browseStart;
  if (browseCount !== expectedBrowseObservationsPerRun) {
    result.runs.push({ runIndex, script: 'browse completeness', exitCode: -1,
      error: `expected ${expectedBrowseObservationsPerRun} Browse observations, got ${browseCount}` });
  }
}

result.classification = result.runs.some(row => row.exitCode !== 0) ? 'BLOCKED'
  : result.targetMisses.length ? 'PERFORMANCE REVIEW REQUIRED' : 'BROWSER TARGETS MET / NATIVE UI UNVERIFIED';
try {
  const taskRoot = path.resolve('.tmp-tests');
  if (!taskRoot.startsWith(process.cwd() + path.sep)) throw new Error('cleanup boundary mismatch');
  if (fs.existsSync(taskRoot)) {
    fs.cpSync(taskRoot, `${output}/browser-failure-evidence`, { recursive: true });
    fs.rmSync(taskRoot, { recursive: true });
  }
  result.cleanup = { taskRemoved: !fs.existsSync(taskRoot) };
} catch (error) {
  result.cleanup = { failure: error.message };
  result.classification = 'BLOCKED';
}
fs.writeFileSync(`${output}/browser.json`, JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(`${output}/browser.md`, `${result.classification}\n\nRepeat count: ${repeatCount}\n\nPreview observations: ${result.previewObservations.length}\nBrowse observations: ${result.browseObservations.length}\nTarget misses: ${result.targetMisses.length}\n\n${JSON.stringify(result.targetMisses, null, 2)}\n\n${result.limitations.join('\n')}\n`);
process.exitCode = result.classification === 'BROWSER TARGETS MET / NATIVE UI UNVERIFIED' ? 0 : 1;
