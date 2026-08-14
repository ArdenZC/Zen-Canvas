import { spawnSync } from "node:child_process";

export function buildPreparedTestArgs(testName, { ignored = true, testThreads } = {}) {
  return [
    testName,
    "--exact",
    ...(ignored ? ["--ignored"] : []),
    "--nocapture",
    ...(testThreads ? [`--test-threads=${testThreads}`] : []),
  ];
}

export function runPreparedTestBinary({
  executable,
  testName,
  ignored = true,
  testThreads,
  cwd,
  env,
  timeoutMs,
  spawnImpl = spawnSync,
  stdio = "inherit",
}) {
  const args = buildPreparedTestArgs(testName, { ignored, testThreads });
  const result = spawnImpl(executable, args, {
    cwd,
    env,
    stdio,
    timeout: timeoutMs,
    windowsHide: true,
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(`Prepared performance binary failed to start: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`Prepared performance binary terminated by signal ${result.signal}.`);
  }
  if (result.status !== 0) {
    const stdout = result.stdout ? `\nstdout:\n${result.stdout}` : "";
    const stderr = result.stderr ? `\nstderr:\n${result.stderr}` : "";
    throw new Error(`Prepared performance binary failed with exit code ${result.status}.${stdout}${stderr}`);
  }
  return result;
}
