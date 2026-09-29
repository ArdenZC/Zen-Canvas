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
        predictions
      ]));
      expect(run.case_count).toBe(12);
      expect(run.adapter.evidence_status).toBe("NOT_BENCHMARK_EVIDENCE");
      expect(readFileSync(predictions, "utf8").trim().split(/\r?\n/u)).toHaveLength(12);

      const summary = JSON.parse(runNode([
        "research/zen-decision-bench/cli/evaluate-predictions.mjs",
        dataset,
        predictions
      ]));
      expect(summary.case_count).toBe(12);
      expect(summary.metrics.acceptable_adjusted_accuracy).toBe(1);
      expect(summary.metrics.provider_failure_rate).toBe(0);
      expect(summary.dataset_hash).toBe(validation.dataset_hash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
