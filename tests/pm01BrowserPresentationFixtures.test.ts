import { afterEach, describe, expect, it, vi } from "vitest";
import { mockInvokeCommand } from "../src/api/browserMockApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PM-01 browser presentation fixtures", () => {
  it("keeps Cleanup assessment and Preview data explicitly presentation-only", async () => {
    vi.stubGlobal("location", new URL("http://localhost/?pm01-readiness=disconnected&pm01-cleanup=current-assessment"));
    const readiness = await mockInvokeCommand<any>("get_ai_feature_readiness");
    expect(readiness.provider.state).toBe("disabled");

    const run = await mockInvokeCommand<any>("start_analysis_run", {
      request: {
        requestKey: "pm01-browser-current-assessment",
        scope: { kind: "approvedCleanupPaths", paths: ["C:/Presentation/Folders"] }
      }
    });
    expect(run.status).toBe("completed");

    const page = await mockInvokeCommand<any>("list_analysis_findings", { runId: run.id, limit: 100 });
    expect(page.findings).toHaveLength(2);
    const review = page.findings.find((finding: { tier: string }) => finding.tier === "review");
    const safe = page.findings.find((finding: { tier: string }) => finding.tier === "safe");
    const evidence = await mockInvokeCommand<any[]>("list_analysis_finding_evidence", { findingId: review.id });
    expect(evidence[0]).toMatchObject({ isCurrentAssessment: true, value: { presentationOnly: true } });

    const preview = await mockInvokeCommand<any>("preview_cleanup_operations", {
      jobId: run.id,
      selections: [{ findingId: safe.id, expectedRevision: safe.revision }]
    });
    expect(preview.previews).toHaveLength(1);
    expect(preview.previews[0].source_path).toBe(safe.pathSnapshot);
  });

  it("can show a failed analysis without claiming a backend readiness change", async () => {
    vi.stubGlobal("location", new URL("http://localhost/?pm01-readiness=ready&pm01-cleanup=analysis-failure"));
    const run = await mockInvokeCommand<any>("start_analysis_run", {
      request: {
        requestKey: "pm01-browser-analysis-failure",
        scope: { kind: "approvedCleanupPaths", paths: ["C:/Presentation/Downloads"] }
      }
    });
    expect(run).toMatchObject({ status: "failed", errorCode: "browser_presentation_analysis_failure" });
  });
});
