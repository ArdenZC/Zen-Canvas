import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
      expect(run.case_count).toBe(12);
      expect(run.split).toBe("pilot");
      expect(run.source_dataset_hash).toBe(validation.dataset_hash);
      expect(run.dataset_hash).toBe(validation.dataset_hash);
      expect(run.adapter.evidence_status).toBe("NOT_BENCHMARK_EVIDENCE");
      expect(readFileSync(predictions, "utf8").trim().split(/\r?\n/u)).toHaveLength(12);

      const summary = JSON.parse(runNode([
        "research/zen-decision-bench/cli/evaluate-predictions.mjs",
        dataset,
        predictions,
        "--split=pilot"
      ]));
      expect(summary.case_count).toBe(12);
      expect(summary.metrics.acceptable_adjusted_accuracy).toBe(1);
      expect(summary.metrics.provider_failure_rate).toBe(0);
      expect(summary.dataset_hash).toBe(validation.dataset_hash);
      expect(summary.selection).toEqual({ split: "pilot", source_case_count: 12 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates the 120-case initial corpus draft without upgrading it to benchmark evidence", () => {
    const dataset = "research/zen-decision-bench/fixtures/initial-corpus.v1.jsonl";
    const manifestPath = "research/zen-decision-bench/fixtures/initial-corpus.v1.manifest.json";
    const validation = JSON.parse(runNode([
      "research/zen-decision-bench/cli/validate-dataset.mjs",
      dataset
    ]));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(validation.valid).toBe(true);
    expect(validation.count).toBe(120);
    expect(validation.task_counts).toEqual({
      domain_type: 20,
      purpose: 20,
      lifecycle: 20,
      risk_level: 20,
      suggested_action: 20,
      existing_folder_choice: 20
    });
    expect(validation.split_counts).toEqual({ pilot: 60, dev: 30, test: 30 });
    expect(manifest.status).toBe("DRAFT_NOT_ADJUDICATED");
    expect(manifest.frozen).toBe(false);
    expect(manifest.test_split_locked).toBe(false);
    expect(manifest.dataset_hash).toBeNull();
    expect(manifest.live_baseline.status).toBe("NOT_RUN");
    expect(manifest.live_baseline.first_allowed_split).toBe("pilot");
    expect(manifest.live_baseline.test_split_allowed_for_tuning).toBe(false);
  });
});
