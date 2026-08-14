export type PreparedTestSpawnResult = {
  status: number | null;
  signal: string | null;
  error?: Error;
  stdout?: string;
  stderr?: string;
};

export type PreparedTestSpawn = (
  command: string,
  args: string[],
  options?: Record<string, unknown>
) => PreparedTestSpawnResult;

export function buildPreparedTestArgs(
  testName: string,
  options?: {
    ignored?: boolean;
    testThreads?: number;
  }
): string[];

export function runPreparedTestBinary(options: {
  executable: string;
  testName: string;
  ignored?: boolean;
  testThreads?: number;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
  spawnImpl?: PreparedTestSpawn;
  stdio?: "inherit" | "pipe";
}): PreparedTestSpawnResult;
