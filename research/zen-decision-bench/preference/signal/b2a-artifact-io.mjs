import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../src/core.mjs";
export const PROFILE_HASH = "371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1";
export const PROFILE_FILE_HASH = "211a879964dfa6bccbadd78e4ad739f4d8324a71dbd974f9fc7a81d0f27ed5fe";
export const PROFILE_IDS = Object.freeze(Array.from({ length: 12 }, (_, i) => `profile-${String(i + 1).padStart(2, "0")}`));
export const fileHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function readFrozen(url, canonical, raw) {
  const bytes = await readFile(url);
  const records = bytes.toString("utf8").trim().split(/\r?\n/u).map(JSON.parse);
  if (sha256(records) !== canonical || fileHash(bytes) !== raw) throw new Error("STOP:frozen_input_hash_drift");
  return records;
}
export const loadProfiles = () => readFrozen(new URL("./profiles.v1.jsonl", import.meta.url), PROFILE_HASH, PROFILE_FILE_HASH);
export async function saveArtifact(name, records, metadata) {
  const data = records.map(JSON.stringify).join("\n") + "\n";
  const manifest = { ...metadata, artifact_file: `${name}.v1.jsonl`, count: records.length,
    canonical_sha256: sha256(records), file_sha256: fileHash(data), research_only: true };
  for (const suffix of ["jsonl", "manifest.json"]) {
    try { await readFile(new URL(`./${name}.v1.${suffix}`, import.meta.url)); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    throw new Error("STOP:artifact_already_exists_use_pure_builder_for_reproducibility");
  }
  await writeFile(new URL(`./${name}.v1.jsonl`, import.meta.url), data);
  await writeFile(new URL(`./${name}.v1.manifest.json`, import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
export const isMain = (url) => process.argv[1] === fileURLToPath(url);
