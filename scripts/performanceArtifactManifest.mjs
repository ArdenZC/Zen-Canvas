import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const PERFORMANCE_ARTIFACT_FORMAT_VERSION = 1;

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
  profile,
  suites,
  rustVersion,
  cargoLockSha256,
  targets,
}) {
  return {
    formatVersion: PERFORMANCE_ARTIFACT_FORMAT_VERSION,
    kind: "performance-binaries",
    commit,
    profile,
    suites: [...suites],
    rustVersion,
    cargoLockSha256,
    targets,
  };
}

export function createFixtureManifest({
  commit,
  profile,
  suites,
  schemaVersion,
  fixtureFormatVersion,
  files,
}) {
  return {
    formatVersion: PERFORMANCE_ARTIFACT_FORMAT_VERSION,
    kind: "performance-fixtures",
    commit,
    profile,
    suites: [...suites],
    schemaVersion,
    fixtureFormatVersion,
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
  if (expectedCommit && manifest.commit !== expectedCommit) {
    throw new Error(`Prepared binary commit mismatch: expected ${expectedCommit}, got ${manifest.commit}`);
  }
  if (expectedProfile && manifest.profile !== expectedProfile) {
    throw new Error(`Prepared binary profile mismatch: expected ${expectedProfile}, got ${manifest.profile}`);
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
  if (expectedCommit && manifest.commit !== expectedCommit) {
    throw new Error(`Prepared fixture commit mismatch: expected ${expectedCommit}, got ${manifest.commit}`);
  }
  if (expectedProfile && manifest.profile !== expectedProfile) {
    throw new Error(`Prepared fixture profile mismatch: expected ${expectedProfile}, got ${manifest.profile}`);
  }
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

export function manifestTargetPath(root, manifest, targetKey) {
  const target = manifest.targets?.[targetKey];
  if (!target) throw new Error(`Prepared binary target is missing: ${targetKey}`);
  return resolveContainedPath(root, target.path, `target ${targetKey}`);
}

export function normalizeManifestPath(value) {
  return normalizeRelativePath(value);
}
