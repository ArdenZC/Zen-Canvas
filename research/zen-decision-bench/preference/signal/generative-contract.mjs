import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sha256, stableJson, readJsonl } from "../../src/core.mjs";
import * as adapter from "../../adapters/managed-ai-deepseek-canonical-enum.mjs";
import { validateSavedCorpus } from "./validate-signal-corpus.mjs";
import { FROZEN_INPUTS, fileHash } from "./assemble-signal-corpus.mjs";

export const EXPERIMENT_ID = "zdb-03b3-same-case-generative-v1";
export const CORPUS = "research/zen-decision-bench/preference/signal/signal-corpus.v1.jsonl";
export const EVIDENCE = "research/zen-decision-bench/results/evidence/zdb-03b3-same-case-generative";
export const CORPUS_HASH = "0a96faa752b488f9c507ee2d0ca64e439820f85697872a64a5972c2840693349";
export const CORPUS_FILE_HASH = "e10cd216a0f6692511ec0049dccf37b51f306bd39625b858efcbac35ebac3c8a";
export const CORPUS_BLOB = "0e483df2063acbc07ee599e3caa379f4a6f404bf";
export const PROMPT_HASH = "c4fd929f7fce4f581cac8328a198cecae164d3db16eeab03c1b74835b233b68b";
export const git = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
export const requirePass = (condition, code) => { if (!condition) throw new Error(`STOP:b3:${code}`); };
export const jsonText = value => JSON.stringify(value, null, 2) + "\n";
export const jsonlText = rows => rows.map(row => JSON.stringify(row)).join("\n") + "\n";

export function checkedConfig() {
  const config = adapter.describeRun();
  requirePass(config.adapter_id === "managed-ai-deepseek-canonical-enum-v1" && adapter.PROMPT_TEMPLATE_SHA256 === PROMPT_HASH, "adapter_prompt");
  requirePass(config.model === "deepseek-v4-flash" && config.endpoint_url === "https://api.deepseek.com/chat/completions" && config.timeout_ms === 120000, "provider_config");
  return config;
}
export function requestFor(testCase) {
  const config = checkedConfig();
  return adapter.buildDeepSeekRequest(testCase, { model: config.model, maxTokens: 4096 });
}
export function proveIsolation(cases) {
  for (const c of cases) {
    const original = JSON.stringify(requestFor(c).body);
    const minimal = { case_id: c.case_id, input: structuredClone(c.input) };
    requirePass(original === JSON.stringify(requestFor(minimal).body), `minimal_request:${c.case_id}`);
    const mutant = structuredClone(c);
    for (const key of Object.keys(mutant)) if (!["case_id", "input"].includes(key)) mutant[key] = { forbidden: "B3_REQUEST_ISOLATION_SENTINEL" };
    for (const key of ["profile", "profile_id", "assignment", "history", "adjudication", "authority_basis", "gold", "acceptable", "abstain_allowed", "preference_context", "preference_evidence", "explicit_user_truth", "deterministic_rules", "cold_start", "tags", "choices", "resolver_recommendation", "expected_answer"]) mutant[key] = ["B3_REQUEST_ISOLATION_SENTINEL"];
    requirePass(original === JSON.stringify(requestFor(mutant).body), `mutation_isolation:${c.case_id}`);
    minimal.input.name += "-changed-current-file";
    requirePass(original !== JSON.stringify(requestFor(minimal).body), `nonconstant_request:${c.case_id}`);
  }
  return { case_count: cases.length, minimal_projection: "PASS", forbidden_metadata_mutation: "PASS", current_file_mutation: "PASS" };
}
export async function frozenCases() {
  const validation = await validateSavedCorpus();
  requirePass(validation.canonical_sha256 === CORPUS_HASH && validation.file_sha256 === CORPUS_FILE_HASH, "corpus_hash");
  requirePass(git(["rev-parse", `HEAD:${CORPUS}`]) === CORPUS_BLOB, "corpus_blob");
  const cases = await readJsonl(CORPUS);
  requirePass(cases.length === 120 && cases.every(c => c.split === "pilot"), "pilot_inventory");
  return cases;
}
export function projection(cases) {
  const isolation = proveIsolation(cases);
  const rows = cases.map(c => {
    const request = requestFor(c);
    return { schema_version: "zdb.request-projection.v1", case_id: c.case_id, expected_ref_id: request.expected_ref_id, request_body_sha256: fileHash(JSON.stringify(request.body)) };
  });
  const manifest = { schema_version: "zdb.request-projection-manifest.v1", projection_id: EXPERIMENT_ID + "-request-projection", case_count: 120,
    corpus_canonical_sha256: CORPUS_HASH, adapter_id: checkedConfig().adapter_id, prompt_sha256: PROMPT_HASH,
    model: "deepseek-v4-flash", endpoint: "https://api.deepseek.com/chat/completions", canonical_sha256: sha256(rows), file_sha256: fileHash(jsonlText(rows)), isolation };
  return { rows, manifest };
}
export async function validateProjection(cases) {
  cases ??= await frozenCases();
  const expected = projection(cases);
  const bytes = await readFile(`${EVIDENCE}/request-projection.v1.jsonl`);
  const saved = JSON.parse(await readFile(`${EVIDENCE}/request-projection.v1.manifest.json`, "utf8"));
  requirePass(bytes.toString("utf8") === jsonlText(expected.rows) && stableJson(saved) === stableJson(expected.manifest), "frozen_request_projection");
  return saved;
}
export function stableErrorCode(error) {
  const message = error instanceof Error ? error.message : "";
  const code = message.split(":", 1)[0];
  return /^(?:managed_ai_[a-z_]+|provider_[a-z_]+|provider_http_\d{3})$/u.test(code) ? code : "unclassified_error";
}
export const sourceHashes = Object.fromEntries(Object.entries(FROZEN_INPUTS).map(([name, hashes]) => [name, { canonical_sha256: hashes[0], file_sha256: hashes[1] }]));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cases = await frozenCases();
  if (process.argv[2] === "--freeze-projection") {
    const result = projection(cases);
    await mkdir(EVIDENCE, { recursive: true });
    await writeFile(`${EVIDENCE}/request-projection.v1.jsonl`, jsonlText(result.rows), { flag: "wx" });
    await writeFile(`${EVIDENCE}/request-projection.v1.manifest.json`, jsonText(result.manifest), { flag: "wx" });
  }
  console.log(jsonText(await validateProjection(cases)));
}
