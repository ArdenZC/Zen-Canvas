export type PerformanceBuildIdentity = {
  buildIdentity: string;
  cargoLockSha256: string;
  rustVersion: string;
  runner: { os: string; arch: string };
  payload: Record<string, unknown>;
};

export function createPerformanceBuildIdentity(args?: {
  profile?: "full" | "extended";
  features?: string;
  targetKeys?: string[];
  rust?: string;
  runnerOs?: string;
  runnerArch?: string;
}): PerformanceBuildIdentity;
