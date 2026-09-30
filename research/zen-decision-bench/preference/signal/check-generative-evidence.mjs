import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { evaluate, readJsonl, stableJson, validatePrediction } from "../../src/core.mjs";
import { EVIDENCE, CORPUS_HASH, frozenCases, validateProjection, requirePass, jsonText } from "./generative-contract.mjs";
import { fileHash, loadFrozenInputs } from "./assemble-signal-corpus.mjs";

export function segmentMetrics(cases, predictions) {
  const ids = new Set(cases.map(c => c.case_id));
  const selected = predictions.filter(p => ids.has(p.case_id));
  const summary = evaluate(cases, selected);
  const counts = summary.counts;
  return { case_count: summary.case_count, exact_count: counts.correct,
    adjusted_count: counts.correct + counts.acceptable_alternate + counts.correct_abstain,
    abstain_count: counts.correct_abstain + counts.unnecessary_abstain, unsafe_overclaim_count: counts.unsafe_overclaim,
    provider_failure_count: counts.provider_failure, counts, metrics: summary.metrics, calibration: summary.calibration,
    mean_latency_ms: selected.reduce((sum, p) => sum + p.latency_ms, 0) / selected.length };
}
export async function checkEvidence(freeze = false) {
  const cases = await frozenCases();
  const projection = await validateProjection(cases);
  const predictions = await readJsonl(`${EVIDENCE}/predictions.jsonl`);
  const run = JSON.parse(await readFile(`${EVIDENCE}/run.json`, "utf8"));
  const summary = JSON.parse(await readFile(`${EVIDENCE}/summary.json`, "utf8"));
  requirePass(predictions.length === 120 && predictions.every((p, i) => p.case_id === cases[i].case_id && validatePrediction(p).length === 0 &&
    Object.keys(p).sort().join(",") === "case_id,confidence,decision,error,latency_ms,schema_version" &&
    (p.error === null || /^(?:managed_ai_[a-z_]+|provider_[a-z_]+|provider_http_\d{3}|unclassified_error)$/u.test(p.error))), "sanitized_prediction_inventory");
  requirePass(run.source_dataset_hash === CORPUS_HASH && run.dataset_hash === CORPUS_HASH && run.case_count === 120 && run.source_case_count === 120 && run.split === "pilot", "run_corpus_binding");
  requirePass(run.predictions.sha256 === fileHash(await readFile(`${EVIDENCE}/predictions.jsonl`)), "prediction_hash");
  requirePass(stableJson(run.request_projection) === stableJson(projection), "run_projection_binding");
  requirePass(run.retry_policy.max_attempts_per_case === 1 && run.retry_policy.retries_performed === 0 && run.request_summary.attempted === 120 &&
    run.request_summary.failed === predictions.filter(p => p.error).length && run.request_summary.succeeded + run.request_summary.failed === 120, "once_only_counts");
  const failureTaxonomy = {};
  for (const p of predictions) if (p.error) failureTaxonomy[p.error] = (failureTaxonomy[p.error] ?? 0) + 1;
  requirePass(stableJson(failureTaxonomy) === stableJson(run.request_summary.failure_taxonomy), "failure_taxonomy");
  requirePass(run.runner.commit === run.runner.candidate_runner_commit && run.runner.tracked_worktree_clean === true &&
    run.runner.candidate_ci.headSha === run.runner.commit && run.runner.candidate_ci.conclusion === "success", "candidate_ci_binding");
  const recomputed = evaluate(cases, predictions);
  requirePass(["dataset_hash", "case_count", "counts", "metrics", "calibration", "scored"].every(key => stableJson(summary[key]) === stableJson(recomputed[key])) &&
    summary.predictions.sha256 === run.predictions.sha256 && summary.run_evidence.runner_commit === run.runner.commit, "unchanged_evaluator_binding");
  const inputs = await loadFrozenInputs();
  const controls = new Map(inputs.targets.map(t => [t.case_id, t.control_class]));
  const groups = { global: segmentMetrics(cases, predictions), per_task: {}, cold_start: {}, controls: {} };
  for (const task of [...new Set(cases.map(c => c.task))]) groups.per_task[task] = segmentMetrics(cases.filter(c => c.task === task), predictions);
  for (const cold of [true, false]) groups.cold_start[cold ? "cold_55" : "non_cold_65"] = segmentMetrics(cases.filter(c => c.preference_context.cold_start === cold), predictions);
  for (const control of [...new Set(controls.values())]) groups.controls[control] = segmentMetrics(cases.filter(c => controls.get(c.case_id) === control), predictions);
  groups.folder_mapping_diagnostic = { task_count: 72, ...groups.per_task.existing_folder_choice,
    mapped_decisions: Object.fromEntries([...new Set(predictions.filter(p => cases.find(c => c.case_id === p.case_id)?.task === "existing_folder_choice").map(p => p.decision ?? "null"))].sort().map(decision =>
      [decision, predictions.filter(p => cases.find(c => c.case_id === p.case_id)?.task === "existing_folder_choice" && (p.decision ?? "null") === decision).length])),
    limitation: "Strict accepted parser maps relative targetTemplate to frozen choice labels after the response. Raw templates are not retained; unmatched templates cannot be distinguished from other parser abstentions. No parser tuning or relabeling." };
  const segmentsPath = `${EVIDENCE}/baseline-segments.json`;
  if (freeze) await writeFile(segmentsPath, jsonText(groups), { flag: "wx" });
  else requirePass(stableJson(JSON.parse(await readFile(segmentsPath, "utf8"))) === stableJson(groups), "segment_metrics");
  const names = ["request-projection.v1.jsonl", "request-projection.v1.manifest.json", "predictions.jsonl", "run.json", "summary.json", "baseline-segments.json"];
  const hashes = [];
  for (const name of names) {
    const bytes = await readFile(`${EVIDENCE}/${name}`);
    requirePass(!/sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9]/u.test(bytes.toString("utf8")), `secret_scan:${name}`);
    hashes.push(`${fileHash(bytes)}  ${name}`);
  }
  const sums = hashes.join("\n") + "\n";
  if (freeze) await writeFile(`${EVIDENCE}/SHA256SUMS.txt`, sums, { flag: "wx" });
  else requirePass(await readFile(`${EVIDENCE}/SHA256SUMS.txt`, "utf8") === sums, "evidence_file_hashes");
  return { valid: true, hashes, request_summary: run.request_summary, global: groups.global, per_task: groups.per_task,
    cold_start: groups.cold_start, controls: groups.controls, provider_usage: run.provider_usage, response_models: run.provider_response_models };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(jsonText(await checkEvidence(process.argv[2] === "--freeze")));
