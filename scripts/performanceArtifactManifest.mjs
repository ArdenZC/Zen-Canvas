import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const PERFORMANCE_ARTIFACT_FORMAT_VERSION = 2;

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/");
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function createBinaryManifest({
  commit,
  generatedFromCommit = commit,
  profile,
  suites,
  rustVersion,
  cargoLockSha256,
  buildIdentity,
  runner,
  features = "",
  cacheScope = "current-run",
  targets,
}) {
  return {
    formatVersion: PERFORMANCE_ARTIFACT_FORMAT_VERSION,
    kind: "performance-binaries",
    cacheScope,
    commit,
    generatedFromCommit,
    profile,
    features,
    suites: [...suites],
    rustVersion,
    cargoLockSha256,
    buildIdentity,
    runner,
    targets,
  };
}

export function createFixtureManifest({
  commit,
  generatedFromCommit = commit,
  profile,
  suites,
  schemaVersion,
  fixtureFormatVersion,
  fixtureIdentity,
  fixtureType = "file-library-sqlite-working-copies",
  rowCounts = [],
  cacheScope = "fixture-cache",
  files,
}) {
  return {
    formatVersion: PERFORMANCE_ARTIFACT_FORMAT_VERSION,
    kind: "performance-fixtures",
    cacheScope,
    commit,
    generatedFromCommit,
    profile,
    suites: [...suites],
    schemaVersion,
    fixtureFormatVersion,
    fixtureIdentity,
    fixtureType,
    rowCounts: [...rowCounts],
    files,
  };
}

function resolveContainedPath(root, relativePath, label) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a relative path.`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`${label} escapes the performance artifact root.`);
  }
  return resolved;
}

export function validateBinaryManifest(root, {
  expectedCommit,
  expectedProfile,
  expectedBuildIdentity,
  expectedCargoLockSha256,
  expectedRustVersion,
  expectedSuites = [],
  expectedCacheScope,
  requiredTargets = [],
} = {}) {
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Prepared performance binary manifest is missing: ${manifestPath}`);
  }
  const manifest = readJson(manifestPath);
  if (manifest.formatVersion !== PERFORMANCE_ARTIFACT_FORMAT_VERSION) {
    throw new Error(`Unsupported performance binary manifest format: ${manifest.formatVersion}`);
  }
  if (manifest.kind !== "performance-binaries") {
    throw new Error(`Unexpected performance artifact kind: ${manifest.kind}`);
  }
  if (typeof manifest.commit !== "string" || !manifest.commit) {
    throw new Error("Prepared binary provenance commit is missing.");
  }
  if (typeof manifest.generatedFromCommit !== "string" || !manifest.generatedFromCommit) {
    throw new Error("Prepared binary generatedFromCommit provenance is missing.");
  }
  if (typeof manifest.buildIdentity !== "string" || !manifest.buildIdentity) {
    throw new Error("Prepared binary build identity is missing.");
  }
  if (typeof manifest.cargoLockSha256 !== "string" || !manifest.cargoLockSha256) {
    throw new Error("Prepared binary Cargo.lock hash is missing.");
  }
  if (expectedCommit && manifest.commit !== expectedCommit) {
    throw new Error(`Prepared binary commit mismatch: expected ${expectedCommit}, got ${manifest.commit}`);
  }
  if (expectedProfile && manifest.profile !== expectedProfile) {
    throw new Error(`Prepared binary profile mismatch: expected ${expectedProfile}, got ${manifest.profile}`);
  }
  if (expectedBuildIdentity && manifest.buildIdentity !== expectedBuildIdentity) {
    throw new Error(`Prepared binary build identity mismatch: expected ${expectedBuildIdentity}, got ${manifest.buildIdentity}`);
  }
  if (expectedCargoLockSha256 && manifest.cargoLockSha256 !== expectedCargoLockSha256) {
    throw new Error("Prepared binary Cargo.lock hash mismatch.");
  }
  if (expectedRustVersion && manifest.rustVersion !== expectedRustVersion) {
    throw new Error("Prepared binary Rust toolchain identity mismatch.");
  }
  if (expectedCacheScope && manifest.cacheScope !== expectedCacheScope) {
    throw new Error(`Prepared binary cache scope mismatch: expected ${expectedCacheScope}, got ${manifest.cacheScope}`);
  }
  for (const suite of expectedSuites) {
    if (!Array.isArray(manifest.suites) || !manifest.suites.includes(suite)) {
      throw new Error(`Prepared binary manifest does not contain required suite: ${suite}`);
    }
  }
  for (const targetKey of requiredTargets) {
    const target = manifest.targets?.[targetKey];
    if (!target) throw new Error(`Prepared binary target is missing: ${targetKey}`);
    const executable = resolveContainedPath(root, target.path, `target ${targetKey}`);
    if (!fs.existsSync(executable)) {
      throw new Error(`Prepared binary is missing: ${executable}`);
    }
    const actualHash = sha256File(executable);
    if (actualHash !== target.sha256) {
      throw new Error(`Prepared binary hash mismatch for ${targetKey}.`);
    }
    const actualSize = fs.statSync(executable).size;
    if (actualSize !== target.size) {
      throw new Error(`Prepared binary size mismatch for ${targetKey}.`);
    }
  }
  return manifest;
}

export function validateFixtureManifest(root, {
  expectedCommit,
  expectedProfile,
  expectedFixtureIdentity,
  expectedFixtureType,
  expectedSchemaVersion,
  expectedFixtureFormatVersion,
  expectedRowCounts = [],
  expectedCacheScope,
  requiredFiles = [],
} = {}) {
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Prepared performance fixture manifest is missing: ${manifestPath}`);
  }
  const manifest = readJson(manifestPath);
  if (manifest.formatVersion !== PERFORMANCE_ARTIFACT_FORMAT_VERSION) {
    throw new Error(`Unsupported performance fixture manifest format: ${manifest.formatVersion}`);
  }
  if (manifest.kind !== "performance-fixtures") {
    throw new Error(`Unexpected performance fixture kind: ${manifest.kind}`);
  }
  if (typeof manifest.commit !== "string" || !manifest.commit) {
    throw new Error("Prepared fixture provenance commit is missing.");
  }
  if (typeof manifest.generatedFromCommit !== "string" || !manifest.generatedFromCommit) {
    throw new Error("Prepared fixture generatedFromCommit provenance is missing.");
  }
  if (expectedCommit && manifest.commit !== expectedCommit) {
    throw new Error(`Prepared fixture commit mismatch: expected ${expectedCommit}, got ${manifest.commit}`);
  }
  if (expectedProfile && manifest.profile !== expectedProfile) {
    throw new Error(`Prepared fixture profile mismatch: expected ${expectedProfile}, got ${manifest.profile}`);
  }
  if (typeof manifest.fixtureIdentity !== "string" || !manifest.fixtureIdentity) {
    throw new Error("Prepared fixture identity is missing.");
  }
  if (typeof manifest.fixtureType !== "string" || !manifest.fixtureType) {
    throw new Error("Prepared fixture type is missing.");
  }
  if (expectedFixtureIdentity && manifest.fixtureIdentity !== expectedFixtureIdentity) {
    throw new Error(`Prepared fixture identity mismatch: expected ${expectedFixtureIdentity}, got ${manifest.fixtureIdentity}`);
  }
  if (expectedFixtureType && manifest.fixtureType !== expectedFixtureType) {
    throw new Error(`Prepared fixture type mismatch: expected ${expectedFixtureType}, got ${manifest.fixtureType}`);
  }
  if (expectedSchemaVersion !== undefined && manifest.schemaVersion !== expectedSchemaVersion) {
    throw new Error(`Prepared fixture schema mismatch: expected ${expectedSchemaVersion}, got ${manifest.schemaVersion}`);
  }
  if (expectedFixtureFormatVersion !== undefined && manifest.fixtureFormatVersion !== expectedFixtureFormatVersion) {
    throw new Error(`Prepared fixture format mismatch: expected ${expectedFixtureFormatVersion}, got ${manifest.fixtureFormatVersion}`);
  }
  if (expectedCacheScope && manifest.cacheScope !== expectedCacheScope) {
    throw new Error(`Prepared fixture cache scope mismatch: expected ${expectedCacheScope}, got ${manifest.cacheScope}`);
  }
  if (expectedRowCounts.length > 0) {
    const actualRows = [...(manifest.rowCounts ?? [])].sort((left, right) => left - right);
    const requiredRows = [...expectedRowCounts].sort((left, right) => left - right);
    if (JSON.stringify(actualRows) !== JSON.stringify(requiredRows)) {
      throw new Error("Prepared fixture row-count identity mismatch.");
    }
  }
  assertNoSqliteSidecars(root);
  for (const relativePath of requiredFiles) {
    const file = manifest.files?.[relativePath];
    if (!file) throw new Error(`Prepared fixture is missing from manifest: ${relativePath}`);
    const resolved = resolveContainedPath(root, relativePath, `fixture ${relativePath}`);
    if (!fs.existsSync(resolved)) throw new Error(`Prepared fixture is missing: ${resolved}`);
    const actualSize = fs.statSync(resolved).size;
    if (actualSize !== file.size) throw new Error(`Prepared fixture size mismatch: ${relativePath}`);
    if (file.sha256 && sha256File(resolved) !== file.sha256) {
      throw new Error(`Prepared fixture hash mismatch: ${relativePath}`);
    }
  }
  return manifest;
}

function assertNoSqliteSidecars(root) {
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(resolved);
        continue;
      }
      if (entry.name.endsWith("-wal") || entry.name.endsWith("-shm")) {
        throw new Error(`Prepared fixture contains a SQLite sidecar: ${resolved}`);
      }
    }
  };
  visit(path.resolve(root));
}

export function manifestTargetPath(root, manifest, targetKey) {
  const target = manifest.targets?.[targetKey];
  if (!target) throw new Error(`Prepared binary target is missing: ${targetKey}`);
  return resolveContainedPath(root, target.path, `target ${targetKey}`);
}

export function normalizeManifestPath(value) {
  return normalizeRelativePath(value);
}
