export type PerformanceBinaryTarget = {
  targetKey?: string;
  path: string;
  size: number;
  sha256: string;
};

export type PerformanceBinaryManifest = {
  formatVersion: number;
  kind: "performance-binaries";
  cacheScope: "build-identity" | "current-run";
  commit: string;
  generatedFromCommit: string;
  profile: "full" | "extended";
  features: string;
  suites: readonly string[];
  rustVersion: string;
  cargoLockSha256: string;
  buildIdentity: string;
  runner?: { os: string; arch: string };
  targets: Record<string, PerformanceBinaryTarget>;
};

export type PerformanceFixtureFile = {
  size: number;
  sha256?: string;
};

export type PerformanceFixtureManifest = {
  formatVersion: number;
  kind: "performance-fixtures";
  cacheScope: "fixture-cache" | "current-run";
  commit: string;
  generatedFromCommit: string;
  profile: "full" | "extended";
  suites: readonly string[];
  schemaVersion: number;
  fixtureFormatVersion: number;
  fixtureIdentity: string;
  fixtureType: string;
  rowCounts: readonly number[];
  files: Record<string, PerformanceFixtureFile>;
};

export function sha256File(filePath: string): string;
export function writeJson(filePath: string, value: unknown): void;
export function readJson(filePath: string): unknown;
export function createBinaryManifest(args: {
  commit: string;
  generatedFromCommit?: string;
  profile: "full" | "extended";
  suites: readonly string[];
  rustVersion: string;
  cargoLockSha256: string;
  buildIdentity: string;
  runner?: { os: string; arch: string };
  features?: string;
  cacheScope?: "build-identity" | "current-run";
  targets: Record<string, PerformanceBinaryTarget>;
}): PerformanceBinaryManifest;
export function createFixtureManifest(args: {
  commit: string;
  generatedFromCommit?: string;
  profile: "full" | "extended";
  suites: readonly string[];
  schemaVersion: number;
  fixtureFormatVersion: number;
  fixtureIdentity: string;
  fixtureType?: string;
  rowCounts?: readonly number[];
  cacheScope?: "fixture-cache" | "current-run";
  files: Record<string, PerformanceFixtureFile>;
}): PerformanceFixtureManifest;
export function validateBinaryManifest(
  root: string,
  options?: {
    expectedCommit?: string;
    expectedProfile?: "full" | "extended";
    expectedBuildIdentity?: string;
    expectedCargoLockSha256?: string;
    expectedRustVersion?: string;
    expectedSuites?: readonly string[];
    expectedCacheScope?: "build-identity" | "current-run";
    requiredTargets?: readonly string[];
  }
): PerformanceBinaryManifest;
export function validateFixtureManifest(
  root: string,
  options?: {
    expectedCommit?: string;
    expectedProfile?: "full" | "extended";
    expectedFixtureIdentity?: string;
    expectedFixtureType?: string;
    expectedSchemaVersion?: number;
    expectedFixtureFormatVersion?: number;
    expectedRowCounts?: readonly number[];
    expectedCacheScope?: "fixture-cache" | "current-run";
    requiredFiles?: readonly string[];
  }
): PerformanceFixtureManifest;
export function manifestTargetPath(
  root: string,
  manifest: PerformanceBinaryManifest,
  targetKey: string
): string;
export function normalizeManifestPath(value: string): string;
