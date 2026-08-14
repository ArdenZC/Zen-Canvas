export type PerformanceProfile = "full" | "extended";
export type PerformanceSuite = "search" | "scan-schema" | "library-content" | "intelligence";

export const PERFORMANCE_SUITES: Record<string, unknown>;
export const PERFORMANCE_SUITE_NAMES: readonly PerformanceSuite[];
export function resolvePerformanceSuite(argv?: readonly string[]): PerformanceSuite;
export function getPerformanceBenchmarks(suite: PerformanceSuite, profile: PerformanceProfile): readonly unknown[];
export function getPrecompileTargets(suite: PerformanceSuite): readonly unknown[];
export function getFixtureKeys(suite: PerformanceSuite, profile: PerformanceProfile): readonly string[];
