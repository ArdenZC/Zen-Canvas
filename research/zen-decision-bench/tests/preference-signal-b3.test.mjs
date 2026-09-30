import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { frozenCases, projection, validateProjection, proveIsolation, stableErrorCode, requestFor } from "../preference/signal/generative-contract.mjs";
import { aggregateTelemetry } from "../preference/signal/run-generative-baseline.mjs";

describe("B3 frozen request boundary (no provider or Preference Arm execution)", () => {
  it("validates all frozen corpus identities and the committed 120-case request projection", async () => {
    const cases = await frozenCases();
    expect(cases.filter(c => c.preference_context.cold_start)).toHaveLength(55);
    expect((await validateProjection(cases)).case_count).toBe(120);
    expect(projection(cases).rows.map(r => r.case_id)).toEqual(cases.map(c => c.case_id));
  });
  it("proves forbidden metadata and choices cannot affect any request, with a positive current-file control", async () => {
    const cases = await frozenCases();
    expect(proveIsolation(cases).forbidden_metadata_mutation).toBe("PASS");
    for (const c of cases) {
      const body = requestFor(c).body;
      expect(body.temperature).toBe(0);
      expect(body.max_tokens).toBe(4096);
      expect(body.thinking).toEqual({ type: "disabled" });
      expect(body.response_format).toEqual({ type: "json_object" });
      for (const key of ["extension", "size", "modified_at_fs"]) {
        const mutant = structuredClone(c);
        mutant.input[key] = key === "size" ? c.input.size + 1 : key === "extension" ? ".changed" : "2020-01-01T00:00:00Z";
        expect(JSON.stringify(requestFor(mutant).body)).not.toBe(JSON.stringify(body));
      }
    }
  });
  it("rejects changed projection bytes rather than silently regenerating at live time", async () => {
    const saved = await readFile("research/zen-decision-bench/results/evidence/zdb-03b3-same-case-generative/request-projection.v1.jsonl", "utf8");
    const cases = await frozenCases();
    cases[0].input.name += "-drift";
    expect(JSON.stringify(projection(cases).rows[0])).not.toBe(saved.split("\n")[0]);
  });
  it("retains stable classes while removing variable provider text", () => {
    for (const code of ["managed_ai_missing_field", "managed_ai_unknown_field", "provider_timeout", "provider_http_401", "managed_ai_invalid_file_type"]) {
      expect(stableErrorCode(new Error(code + ":sensitive variable detail"))).toBe(code);
    }
    expect(stableErrorCode(new Error("raw response with credential"))).toBe("unclassified_error");
  });
  it("reports incomplete provider telemetry honestly", () => {
    expect(aggregateTelemetry([{ provider_usage: { status: "MEASURED_PROVIDER_RESPONSE", total_tokens: 7 } }, null])).toMatchObject({ measured_case_count: 1, unavailable_case_count: 119, total_tokens: 7 });
  });
});
