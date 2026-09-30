import { execFileSync } from "node:child_process";
import { mkdir, open, readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as adapter from "../../adapters/managed-ai-deepseek-canonical-enum.mjs";
import { EXPERIMENT_ID, CORPUS, EVIDENCE, CORPUS_HASH, CORPUS_FILE_HASH, CORPUS_BLOB, frozenCases, validateProjection,
  checkedConfig, git, requirePass, stableErrorCode, sourceHashes, jsonText } from "./generative-contract.mjs";
import { fileHash } from "./assemble-signal-corpus.mjs";

export function aggregateTelemetry(rows) {
  const fields = ["prompt_tokens", "completion_tokens", "total_tokens", "prompt_cache_hit_tokens", "prompt_cache_miss_tokens"];
  const totals = Object.fromEntries(fields.map(field => [field, 0]));
  let measured = 0;
  for (const row of rows) {
    const usage = row?.provider_usage;
    if (usage?.status !== "MEASURED_PROVIDER_RESPONSE") continue;
    measured++;
    for (const field of fields) if (Number.isFinite(usage[field]) && usage[field] >= 0) totals[field] += usage[field];
  }
  return { status: measured ? "MEASURED_PROVIDER_RESPONSE" : "UNAVAILABLE", measured_case_count: measured, unavailable_case_count: 120 - measured, ...totals };
}
export async function runLive() {
  requirePass(process.argv[2] === "--live-once", "explicit_live_mode");
  const cases = await frozenCases();
  const projectionManifest = await validateProjection(cases);
  const config = checkedConfig();
  const head = git(["rev-parse", "HEAD"]);
  requirePass(process.env.ZDB_RUNNER_COMMIT === head && /^[0-9a-f]{40}$/u.test(head), "candidate_commit");
  requirePass(git(["status", "--porcelain"]) === "", "clean_candidate_worktree");
  const ciId = process.env.ZDB_CANDIDATE_CI_RUN_ID;
  requirePass(/^\d+$/u.test(ciId ?? ""), "candidate_ci_id");
  const ci = JSON.parse(execFileSync("gh", ["run", "view", ciId, "--json", "headSha,conclusion,status,workflowName"], { encoding: "utf8" }));
  requirePass(ci.headSha === head && ci.conclusion === "success" && ci.status === "completed" && ci.workflowName === "CI", "candidate_ci_exact_head_success");
  adapter.assertRunReady();
  for (const name of ["predictions.jsonl", "run.json", "summary.json", "SHA256SUMS.txt"]) {
    let exists = true;
    try { await access(`${EVIDENCE}/${name}`); } catch (error) { if (error.code === "ENOENT") exists = false; else throw error; }
    requirePass(!exists, `existing_evidence:${name}`);
  }
  await mkdir(".tmp-tests/zdb-03b3", { recursive: true });
  const lock = await open(".tmp-tests/zdb-03b3/live-attempt.lock", "wx");
  await lock.writeFile(jsonText({ candidate_runner_commit: head, candidate_ci: ciId, started_at: new Date().toISOString(), retry_forbidden: true }));
  await lock.close();
  // Exclusive durable attempt marker forbids restarting a crashed or completed run.
  const output = await open(`${EVIDENCE}/predictions.jsonl`, "wx");
  const startedAt = new Date().toISOString();
  const rows = [], telemetry = [];
  try {
    for (const c of cases) {
      const start = performance.now();
      let result, error = null;
      try { result = await adapter.predict(c); } catch (failure) { error = stableErrorCode(failure); }
      const row = { schema_version: "zdb.prediction.v1", case_id: c.case_id, decision: error ? null : result?.decision ?? null,
        confidence: error ? null : result?.confidence ?? null, latency_ms: performance.now() - start, error };
      rows.push(row);
      telemetry.push(result?.telemetry ?? null);
      await output.writeFile(JSON.stringify(row) + "\n");
      await output.sync();
      console.log(`B3 progress ${rows.length}/120; failures ${rows.filter(r => r.error).length}`);
    }
  } finally { await output.close(); }
  const taxonomy = {};
  for (const row of rows) if (row.error) taxonomy[row.error] = (taxonomy[row.error] ?? 0) + 1;
  const failed = rows.filter(r => r.error).length;
  const ownerManifest = JSON.parse(await readFile(CORPUS.replace(".jsonl", ".manifest.json"), "utf8"));
  const run = { schema_version: "zdb.run.v2", evidence_status: "LIVE_PROVIDER_RUN", experiment_id: EXPERIMENT_ID,
    started_at: startedAt, finished_at: new Date().toISOString(), source_dataset_hash: CORPUS_HASH, dataset_hash: CORPUS_HASH,
    split: "pilot", source_case_count: 120, case_count: rows.length,
    signal_corpus: { path: CORPUS, canonical_sha256: CORPUS_HASH, file_sha256: CORPUS_FILE_HASH, git_blob: CORPUS_BLOB,
      manifest_path: CORPUS.replace(".jsonl", ".manifest.json"), manifest_status: ownerManifest.status, owner_freeze: ownerManifest.owner_freeze, sources: sourceHashes },
    preflight_chronology: { blocked_attempt_count: 2, blocked_attempt_provider_requests: 0, blocked_attempt_preference_arm_executions: 0,
      starting_master: "3fd3e9afcdc9835dc7171d1f57d1c7542d79191b", hotfixes: [
        { pr: 307, merge_master: "849e1f2deb2defb1f011751158962de7201960f8", merge_after_ci: "36678724353" },
        { pr: 308, merge_master: "3fd3e9afcdc9835dc7171d1f57d1c7542d79191b", merge_after_ci: "36681266215" }] },
    runner: { commit: head, candidate_runner_commit: head, tree: git(["rev-parse", "HEAD^{tree}"]), tracked_worktree_clean: true,
      node: process.version, platform: process.platform, arch: process.arch, candidate_ci: { run_id: ciId, ...ci } },
    adapter: { ...config, experiment_id: EXPERIMENT_ID, accepted_adapter_experiment_id: config.experiment_id },
    request_projection: projectionManifest, retry_policy: { policy: "none", max_attempts_per_case: 1, retries_performed: 0 },
    request_summary: { attempted: rows.length, succeeded: rows.length - failed, failed, failure_taxonomy: taxonomy },
    provider_usage: aggregateTelemetry(telemetry), provider_response_models: [...new Set(telemetry.map(t => t?.response_model).filter(Boolean))].sort(),
    monetary_cost: { status: "UNAVAILABLE_NO_FROZEN_PRICE_SOURCE", amount: null, currency: null },
    predictions: { path: `${EVIDENCE}/predictions.jsonl`, sha256: fileHash(await readFile(`${EVIDENCE}/predictions.jsonl`)) },
    run_manifest_path: `${EVIDENCE}/run.json`, preference_arm_executions: 0, raw_provider_responses_retained: false,
    credential_handling: "process environment only; presence checked; no freshness or non-exposure claim; latest Owner authorization" };
  await writeFile(`${EVIDENCE}/run.json`, jsonText(run), { flag: "wx" });
  console.log(jsonText(run.request_summary));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await runLive();
