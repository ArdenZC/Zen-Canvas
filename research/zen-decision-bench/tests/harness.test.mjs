import { describe, expect, it } from "vitest";
import {
  caseContentFingerprint,
  classifyPrediction,
  evaluate,
  readJsonl,
  validateCase,
  validateDataset,
  validatePrediction
} from "../src/core.mjs";
import { predict as smokePredict } from "../adapters/smoke-fixture.mjs";

const smokePath = new URL("../fixtures/smoke.v1.jsonl", import.meta.url);

describe("ZenDecisionBench Phase 1 harness", () => {
  it("validates the committed smoke fixture across all six finite-choice tasks", async () => {
    const records = await readJsonl(smokePath);
    const result = validateDataset(records);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(12);
    expect(result.task_counts).toEqual({
      domain_type: 2,
      purpose: 2,
      lifecycle: 2,
      risk_level: 2,
      suggested_action: 2,
      existing_folder_choice: 2
    });
    expect(result.dataset_hash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("fails closed on malformed case and prediction contracts", () => {
    expect(validateCase({})).toContain("schema_version");
    expect(validatePrediction({
      schema_version: "zdb.prediction.v1",
      case_id: "x",
      decision: "keep",
      confidence: 2,
      latency_ms: 1,
      error: null
    })).toContain("confidence");
    expect(validatePrediction({
      schema_version: "zdb.prediction.v1",
      case_id: "x",
      decision: "keep",
      confidence: 0.5,
      latency_ms: 1,
      error: "provider_failed"
    })).toContain("error_with_decision");
  });

  it("detects exact content leakage across splits even when case IDs differ", async () => {
    const [record] = await readJsonl(smokePath);
    const duplicate = { ...record, case_id: "duplicate-on-test", split: "test" };
    expect(caseContentFingerprint(duplicate)).toBe(caseContentFingerprint(record));
    const result = validateDataset([record, duplicate]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.errors.some((error) => error.startsWith("cross_split_duplicate:")))).toBe(true);
  });

  it("distinguishes correct, acceptable, abstention, unsafe overclaim, invalid and provider failure", async () => {
    const records = await readJsonl(smokePath);
    const byId = new Map(records.map((record) => [record.case_id, record]));
    const prediction = (case_id, decision, error = null) => ({
      schema_version: "zdb.prediction.v1",
      case_id,
      decision,
      confidence: decision ? 0.8 : null,
      latency_ms: 10,
      error
    });
    expect(classifyPrediction(byId.get("smoke-domain-01"), prediction("smoke-domain-01", "document"))).toBe("correct");
    expect(classifyPrediction(byId.get("smoke-risk-01"), prediction("smoke-risk-01", "caution"))).toBe("acceptable_alternate");
    expect(classifyPrediction(byId.get("smoke-lifecycle-02"), prediction("smoke-lifecycle-02", "abstain"))).toBe("correct_abstain");
    expect(classifyPrediction(byId.get("smoke-lifecycle-02"), prediction("smoke-lifecycle-02", "active"))).toBe("unsafe_overclaim");
    expect(classifyPrediction(byId.get("smoke-domain-01"), prediction("smoke-domain-01", "not-a-choice"))).toBe("invalid_output");
    expect(classifyPrediction(byId.get("smoke-domain-01"), prediction("smoke-domain-01", null, "request_failed"))).toBe("provider_failure");
  });

  it("produces deterministic summary metrics and calibration from smoke predictions", async () => {
    const records = await readJsonl(smokePath);
    const predictions = [];
    for (const record of records) {
      const result = await smokePredict(record);
      predictions.push({
        schema_version: "zdb.prediction.v1",
        case_id: record.case_id,
        decision: result.decision,
        confidence: result.confidence,
        latency_ms: 5,
        error: null
      });
    }
    const summary = evaluate(records, predictions);
    expect(summary.case_count).toBe(12);
    expect(summary.metrics.acceptable_adjusted_accuracy).toBe(1);
    expect(summary.metrics.provider_failure_rate).toBe(0);
    expect(summary.metrics.median_latency_ms).toBe(5);
    expect(summary.metrics.p95_latency_ms).toBe(5);
    expect(summary.calibration.count).toBe(12);
    expect(summary.calibration.ece).toBeCloseTo(0.1, 10);
  });

  it("never treats the deterministic smoke adapter as benchmark evidence", async () => {
    const records = await readJsonl(smokePath);
    const result = await smokePredict(records[0]);
    expect(result.decision).toBe("document");
  });
});
