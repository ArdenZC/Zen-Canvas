import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function runNode(args: string[]) {
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

describe("ZenDecisionBench research contract", () => {
  it("validates the smoke dataset and runs the bounded offline baseline/evaluator end to end", () => {
    const root = mkdtempSync(join(tmpdir(), "zen-zdb-contract-"));
    try {
      const dataset = "research/zen-decision-bench/fixtures/smoke.v1.jsonl";
      const predictions = join(root, "predictions.jsonl");

      const validation = JSON.parse(runNode([
        "research/zen-decision-bench/cli/validate-dataset.mjs",
        dataset
      ]));
      expect(validation.valid).toBe(true);
      expect(validation.count).toBe(12);
      expect(validation.task_counts).toEqual({
        domain_type: 2,
        purpose: 2,
        lifecycle: 2,
        risk_level: 2,
        suggested_action: 2,
        existing_folder_choice: 2
      });

      const run = JSON.parse(runNode([
        "research/zen-decision-bench/cli/run-baseline.mjs",
        dataset,
        "research/zen-decision-bench/adapters/smoke-fixture.mjs",
        predictions,
        "--split",
        "pilot"
      ]));
      expect(run.schema_version).toBe("zdb.run.v2");
      expect(run.case_count).toBe(12);
      expect(run.split).toBe("pilot");
      expect(run.source_dataset_hash).toBe(validation.dataset_hash);
      expect(run.dataset_hash).toBe(validation.dataset_hash);
      expect(run.adapter.evidence_status).toBe("NOT_BENCHMARK_EVIDENCE");
      expect(run.retry_policy).toEqual({
        policy: "none",
        max_attempts_per_case: 1,
        retries_performed: 0
      });
      expect(run.request_summary).toEqual({
        attempted: 12,
        succeeded: 12,
        failed: 0,
        failure_taxonomy: {}
      });
      expect(run.monetary_cost.status).toBe("NOT_APPLICABLE_FIXTURE");
      expect(run.predictions.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(readFileSync(run.run_manifest_path, "utf8")).toContain('"schema_version": "zdb.run.v2"');
      expect(readFileSync(predictions, "utf8").trim().split(/\r?\n/u)).toHaveLength(12);

      const summary = JSON.parse(runNode([
        "research/zen-decision-bench/cli/evaluate-predictions.mjs",
        dataset,
        predictions,
        "--split=pilot",
        "--out",
        join(root, "summary.json")
      ]));
      expect(summary.case_count).toBe(12);
      expect(summary.metrics.acceptable_adjusted_accuracy).toBe(1);
      expect(summary.metrics.provider_failure_rate).toBe(0);
      expect(summary.dataset_hash).toBe(validation.dataset_hash);
      expect(summary.source_dataset_hash).toBe(validation.dataset_hash);
      expect(summary.selection).toEqual({ split: "pilot", source_case_count: 12, selected_case_count: 12 });
      expect(readFileSync(join(root, "summary.json"), "utf8")).toContain('"acceptable_adjusted_accuracy": 1');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails live provider execution before requests unless frozen evidence and credentials are present", () => {
    const root = mkdtempSync(join(tmpdir(), "zen-zdb-live-readiness-"));
    try {
      const dataset = "research/zen-decision-bench/fixtures/initial-corpus.v1.jsonl";
      const manifest = "research/zen-decision-bench/fixtures/initial-corpus.v1.manifest.json";
      const adapter = "research/zen-decision-bench/adapters/managed-ai-deepseek.mjs";
      const predictions = join(root, "predictions.jsonl");
      const env = { ...process.env, DEEPSEEK_API_KEY: "" };

      const withoutManifest = spawnSync(process.execPath, [
        "research/zen-decision-bench/cli/run-baseline.mjs",
        dataset,
        adapter,
        predictions,
        "--split",
        "pilot"
      ], { cwd: process.cwd(), encoding: "utf8", env });
      expect(withoutManifest.status).not.toBe(0);
      expect(withoutManifest.stderr).toContain("live_zdb_baseline_requires_frozen_manifest");
      expect(existsSync(predictions)).toBe(false);

      const withoutCredential = spawnSync(process.execPath, [
        "research/zen-decision-bench/cli/run-baseline.mjs",
        dataset,
        adapter,
        predictions,
        "--split",
        "pilot",
        "--manifest",
        manifest
      ], { cwd: process.cwd(), encoding: "utf8", env });
      expect(withoutCredential.status).not.toBe(0);
      expect(withoutCredential.stderr).toContain("DEEPSEEK_API_KEY_REQUIRED_FOR_LIVE_ZDB_BASELINE");
      expect(existsSync(predictions)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("enforces the owner-adjudicated frozen corpus and locked test split hashes", () => {
    const dataset = "research/zen-decision-bench/fixtures/initial-corpus.v1.jsonl";
    const manifestPath = "research/zen-decision-bench/fixtures/initial-corpus.v1.manifest.json";
    const validation = JSON.parse(runNode([
      "research/zen-decision-bench/cli/validate-dataset.mjs",
      dataset
    ]));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(validation.valid).toBe(true);
    expect(validation.count).toBe(180);
    expect(validation.task_counts).toEqual({
      domain_type: 30,
      purpose: 30,
      lifecycle: 30,
      risk_level: 30,
      suggested_action: 30,
      existing_folder_choice: 30
    });
    expect(validation.split_counts).toEqual({ pilot: 120, dev: 30, test: 30 });
    expect(manifest.status).toBe("FROZEN_OWNER_ADJUDICATED");
    expect(manifest.frozen).toBe(true);
    expect(manifest.test_split_locked).toBe(true);
    expect(manifest.dataset_hash).toBe(validation.dataset_hash);
    expect(manifest.dataset_hash).toBe("d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68");
    expect(manifest.test_split_hash).toBe(validation.split_hashes.test);
    expect(manifest.test_split_hash).toBe("4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12");
    expect(manifest.pilot_task_counts).toEqual({
      domain_type: 20,
      purpose: 20,
      lifecycle: 20,
      risk_level: 20,
      suggested_action: 20,
      existing_folder_choice: 20
    });
    expect(manifest.owner_adjudication.previously_reviewed_120).toBe("ACCEPTED_2026-09-29");
    expect(manifest.owner_adjudication.pilot_expansion_60).toBe("ACCEPTED_AFTER_SECOND_PASS_2026-09-29");
    expect(manifest.owner_adjudication.full_corpus).toBe("ACCEPTED_AND_FROZEN_2026-09-29");
    expect(manifest.live_baseline.status).toBe("NOT_RUN");
    expect(manifest.live_baseline.first_allowed_split).toBe("pilot");
    expect(manifest.live_baseline.test_split_allowed_for_tuning).toBe(false);
    expect(manifest.live_baseline.required_run_schema).toBe("zdb.run.v2");
    expect(manifest.live_baseline.requires_frozen_manifest).toBe(true);
    expect(manifest.live_baseline.requires_clean_tracked_worktree).toBe(true);
    expect(manifest.live_baseline.retry_policy).toBe("none");
  });
});
