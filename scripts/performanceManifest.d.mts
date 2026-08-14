export type PerformanceProfile = "full" | "extended";
export type PerformanceSuite = "search" | "scan-schema" | "library-content" | "intelligence";
export type PerformanceTargetKey = "lib" | "fts" | "migrations" | "fileLibrary" | "fixtureBuilder";
export type PerformanceTarget = {
  id: string;
  cargoArgs: readonly string[];
  executableStem: string;
  shardTarget: boolean;
};
export type PerformancePrecompileTarget = {
  id: string;
  targetKey: PerformanceTargetKey;
  targetArgs: readonly string[];
};

export const PERFORMANCE_SUITES: Record<string, unknown>;
export const PERFORMANCE_SUITE_NAMES: readonly PerformanceSuite[];
export const PERFORMANCE_TARGETS: Record<PerformanceTargetKey, PerformanceTarget>;
export function resolvePerformanceSuite(argv?: readonly string[]): PerformanceSuite;
export function getPerformanceBenchmarks(suite: PerformanceSuite, profile: PerformanceProfile): readonly unknown[];
export function getPrecompileTargets(suite: PerformanceSuite): readonly PerformancePrecompileTarget[];
export function getPrecompileTargetsForSuites(
  suites: readonly PerformanceSuite[]
): readonly PerformancePrecompileTarget[];
export function getRequiredBinaryKeys(suite: PerformanceSuite): readonly PerformanceTargetKey[];
export function getFixtureWorkingFiles(
  suite: PerformanceSuite,
  profile: PerformanceProfile
): readonly string[];
export function getFixtureWorkingFilesForSuites(
  suites: readonly PerformanceSuite[],
  profile: PerformanceProfile
): readonly string[];
export function getFixtureKeys(suite: PerformanceSuite, profile: PerformanceProfile): readonly string[];
