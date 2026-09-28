// CI/reproducibility adapter only. It is intentionally case-ID keyed and MUST NOT be used as benchmark evidence.
const decisions = new Map([
  ["smoke-domain-01", "document"],
  ["smoke-domain-02", "code"],
  ["smoke-purpose-01", "study"],
  ["smoke-purpose-02", "work"],
  ["smoke-lifecycle-01", "active"],
  ["smoke-lifecycle-02", "abstain"],
  ["smoke-risk-01", "normal"],
  ["smoke-risk-02", "high"],
  ["smoke-action-01", "keep"],
  ["smoke-action-02", "review"],
  ["smoke-folder-01", "folder-project"],
  ["smoke-folder-02", "abstain"]
]);

export const metadata = Object.freeze({
  adapter_id: "smoke-fixture-v1",
  evidence_status: "NOT_BENCHMARK_EVIDENCE",
  provider: "deterministic_fixture"
});

export async function predict(testCase) {
  const decision = decisions.get(testCase.case_id);
  if (!decision) throw new Error("unknown_smoke_case");
  return { decision, confidence: 0.9 };
}
