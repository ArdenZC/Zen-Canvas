export const PERFORMANCE_FIXTURE_SCHEMA_VERSION: number;
export const PERFORMANCE_FIXTURE_FORMAT_VERSION: number;

export type PerformanceFixtureIdentity = {
  fixtureIdentity: string;
  fixtureCacheKey: string;
  fixtureFormatVersion: number;
  schemaVersion: number;
  rowCounts: readonly number[];
  runner: { os: string; arch: string };
  payload: Record<string, unknown>;
  requiredFiles: readonly string[];
};

export function createPerformanceFixtureIdentity(args?: {
  profile?: "full" | "extended";
  runnerOs?: string;
  runnerArch?: string;
}): PerformanceFixtureIdentity;
