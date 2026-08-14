export type PerformanceBinaryTarget = {
  targetKey?: string;
  path: string;
  size: number;
  sha256: string;
};

export type PerformanceBinaryManifest = {
  formatVersion: number;
  kind: "performance-binaries";
  commit: string;
  profile: "full" | "extended";
  suites: readonly string[];
  rustVersion: string;
  cargoLockSha256: string;
  targets: Record<string, PerformanceBinaryTarget>;
};

export type PerformanceFixtureFile = {
  size: number;
  sha256?: string;
};

export type PerformanceFixtureManifest = {
  formatVersion: number;
  kind: "performance-fixtures";
  commit: string;
  profile: "full" | "extended";
  suites: readonly string[];
  schemaVersion: number;
  fixtureFormatVersion: number;
  files: Record<string, PerformanceFixtureFile>;
};

export function sha256File(filePath: string): string;
export function writeJson(filePath: string, value: unknown): void;
export function readJson(filePath: string): unknown;
export function createBinaryManifest(args: {
  commit: string;
  profile: "full" | "extended";
  suites: readonly string[];
  rustVersion: string;
  cargoLockSha256: string;
  targets: Record<string, PerformanceBinaryTarget>;
}): PerformanceBinaryManifest;
export function createFixtureManifest(args: {
  commit: string;
  profile: "full" | "extended";
  suites: readonly string[];
  schemaVersion: number;
  fixtureFormatVersion: number;
  files: Record<string, PerformanceFixtureFile>;
}): PerformanceFixtureManifest;
export function validateBinaryManifest(
  root: string,
  options?: {
    expectedCommit?: string;
    expectedProfile?: "full" | "extended";
    requiredTargets?: readonly string[];
  }
): PerformanceBinaryManifest;
export function validateFixtureManifest(
  root: string,
  options?: {
    expectedCommit?: string;
    expectedProfile?: "full" | "extended";
    requiredFiles?: readonly string[];
  }
): PerformanceFixtureManifest;
export function manifestTargetPath(
  root: string,
  manifest: PerformanceBinaryManifest,
  targetKey: string
): string;
export function normalizeManifestPath(value: string): string;
