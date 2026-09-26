import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
const output = '.performance-artifacts/qualification';
if (fs.existsSync('.tmp-tests')) throw new Error('refusing pre-existing browser task data');
fs.mkdirSync(output, { recursive: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== process.env.EXPECTED_SOURCE_SHA) throw new Error('source mismatch');
const env = { ...process.env, W310_SOURCE_HEAD: head, W310_EXPECTED_CHECKOUT_SHA: head,
  W211_SOURCE_HEAD: head, W211_EXPECTED_CHECKOUT_SHA: head,
  ZC_QUALIFICATION_OUTPUT: `${output}/preview-browser.json`,
  ZC_BROWSE_QUALIFICATION_OUTPUT: `${output}/browse-browser.json` };
const result = { sourceHead: head, classification: 'UNVERIFIED', runs: [], targetMisses: [],
  limitations: ['Browser mock measures DOM timing; native/system useful representation is separate.',
    'Browse DOM timing uses the existing browser mock; real filesystem first page is measured separately by Workspace Foundation.'] };
for (const script of ['runW3-10PhaseABrowserHarness.mjs', 'runW2-11BrowserGate.mjs']) {
  const observation = spawnSync(process.execPath, [`scripts/${script}`], { env, encoding: 'utf8', windowsHide: true,
    timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(`${output}/${script}.log`, (observation.stdout ?? '') + (observation.stderr ?? ''));
  result.runs.push({ script, exitCode: observation.status, error: observation.error?.message });
}
if (fs.existsSync(`${output}/preview-browser.json`)) {
  const preview = JSON.parse(fs.readFileSync(`${output}/preview-browser.json`, 'utf8'));
  for (const viewport of preview.evidence) for (const scenario of viewport.evidence) {
    for (const metric of ['shell', 'useful']) {
      const row = scenario[metric];
      if (row.p95Ms > row.targetP95Ms) result.targetMisses.push({ viewport: viewport.viewport, scenario: scenario.label, metric, ...row });
    }
  }
} else result.runs.push({ script: 'preview metrics', exitCode: -1 });
if (fs.existsSync(`${output}/browse-browser.json`)) {
  const browse = JSON.parse(fs.readFileSync(`${output}/browse-browser.json`, 'utf8'));
  for (const row of browse.evidence) {
    if (row.feedbackP95Ms > row.feedbackTargetP95Ms || row.usefulP95Ms > row.usefulTargetP95Ms) result.targetMisses.push({ scenario: 'browse-transition', ...row });
  }
} else result.runs.push({ script: 'browse metrics', exitCode: -1 });
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
fs.writeFileSync(`${output}/browser.md`, `${result.classification}\n\n${JSON.stringify(result.targetMisses, null, 2)}\n\n${result.limitations.join('\n')}\n`);
process.exitCode = result.classification === 'BROWSER TARGETS MET / NATIVE UI UNVERIFIED' ? 0 : 1;
