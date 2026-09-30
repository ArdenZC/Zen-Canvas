import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readJsonl, sha256, stableJson, evaluate } from "../../src/core.mjs";
import { loadFrozenInputs, fileHash } from "./assemble-signal-corpus.mjs";
import { validateSavedCorpus } from "./validate-signal-corpus.mjs";
import { validateBlindAdjudication } from "./validate-adjudication.mjs";

export const START = "0fc3751de02a4acab07ff45dbd6523c8efa35a65";
export const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const OUT = new URL("../../results/evidence/zdb-03b4-preference-screen/", import.meta.url);
export const BASELINE = new URL("../../results/evidence/zdb-03b3-same-case-generative/", import.meta.url);
export const BLOBS = Object.freeze({ resolver: "6b30e4bb5a34ad510e9ff0a4bdcdb19875e28dfb", evaluate: "2255811fcef7450cf383983e7a3f7bb1c3bdb904", "validate-context": "4e0e77dcabfdc505f199bb62ca3ee30abfeec58f" });
export const HASHES = Object.freeze({
  "predictions.jsonl": "de5c1b87b5ac255d45f17500f0e560ccc2eaeca0f60ebf3defc0437694e2e617",
  "run.json": "bb30f28718d32f4c3243f281c49b8334f0bf4dbcbbad2b24d847dc8881cf6b43",
  "summary.json": "54ad22c8e07a8a4f6e1c2a128ee39a13bbeae74c647d480f3a8b69b619bebc55",
  "baseline-segments.json": "a270e606fd958dc8505ee0eaaa9dbb2bdb3c07299e49fa3bed7cbcd5a96501c7"
});
export const requirePass = (ok, code) => { if (!ok) throw new Error(`STOP:b4:${code}`); };
export const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
export const jsonText = value => JSON.stringify(value, null, 2) + "\n";
export const jsonlText = rows => rows.map(row => JSON.stringify(row)).join("\n") + "\n";
export const primary = c => ["existing_folder_choice", "suggested_action"].includes(c.task);
export const eligible = p => p.error == null && p.decision != null;

// Verify every pre-existing research file against the exact starting tree,
// including manifests, frozen construction sources and all B3 evidence.
export async function verifyFrozenTree() {
  const entries = git("ls-tree", "-r", START, "research/zen-decision-bench").split("\n");
  for (const line of entries) {
    const [, expected, path] = line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/u) ?? [];
    requirePass(expected && path, "frozen_tree_entry");
    const bytes = await readFile(`${ROOT}/${path}`);
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    requirePass(actual === expected, `frozen_blob:${path}`);
  }
  for (const [name, expected] of Object.entries(BLOBS)) requirePass(git("hash-object", `research/zen-decision-bench/preference/src/${name}.mjs`) === expected, `implementation_blob:${name}`);
  return { checked_files: entries.length, hash_drift: 0, starting_tree: git("rev-parse", `${START}^{tree}`) };
}
export async function loadScreenInputs() {
  const frozenTree = await verifyFrozenTree();
  const corpus = await validateSavedCorpus();
  requirePass(corpus.canonical_sha256 === "0a96faa752b488f9c507ee2d0ca64e439820f85697872a64a5972c2840693349" && corpus.file_sha256 === "e10cd216a0f6692511ec0049dccf37b51f306bd39625b858efcbac35ebac3c8a", "corpus_hash");
  const inputs = await loadFrozenInputs();
  const blindness = await validateBlindAdjudication();
  requirePass(blindness.valid, "owner_blindness_chain");
  const cases = await readJsonl(new URL("./signal-corpus.v1.jsonl", import.meta.url));
  for (const [name, hash] of Object.entries(HASHES)) requirePass(fileHash(await readFile(new URL(name, BASELINE))) === hash, `baseline_hash:${name}`);
  const baseline = await readJsonl(new URL("predictions.jsonl", BASELINE));
  requirePass(baseline.length === 120 && baseline.every((p, i) => p.case_id === cases[i].case_id), "baseline_inventory");
  const failures = baseline.filter(p => !eligible(p));
  requirePass(baseline.filter(eligible).length === 116 && failures.length === 4 && failures.every(p => p.error === "managed_ai_missing_field" && p.decision === null), "baseline_116_4");
  requirePass(cases.filter(primary).length === 108 && cases.filter((c, i) => primary(c) && eligible(baseline[i])).length === 104 &&
    cases.filter((c, i) => c.task === "existing_folder_choice" && !eligible(baseline[i])).length === 1 && cases.filter((c, i) => c.task === "suggested_action" && !eligible(baseline[i])).length === 3, "primary_104_4");
  const summary = JSON.parse(await readFile(new URL("summary.json", BASELINE), "utf8"));
  const recomputed = evaluate(cases, baseline);
  for (const key of ["dataset_hash", "case_count", "counts", "metrics", "calibration", "scored"]) requirePass(stableJson(summary[key]) === stableJson(recomputed[key]), `baseline_scoring:${key}`);
  return { cases, baseline, inputs, corpus, frozenTree, blindness };
}
