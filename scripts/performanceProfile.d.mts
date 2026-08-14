export type PerformanceProfile = "full" | "extended";

export function resolvePerformanceProfile(argv?: readonly string[]): PerformanceProfile;
