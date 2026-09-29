import { describe, expect, it } from "vitest";
import { readJsonl, validateDataset } from "../src/core.mjs";
import {
  assessmentToDecision,
  buildDeepSeekRequest,
  buildManagedMetadata,
  describeRun,
  metadata,
  parseProviderResponse,
  predict
} from "../adapters/managed-ai-deepseek.mjs";

const corpusPath = new URL("../fixtures/initial-corpus.v1.jsonl", import.meta.url);

async function byId() {
  const records = await readJsonl(corpusPath);
  return new Map(records.map((record) => [record.case_id, record]));
}

function assessment(testCase, overrides = {}) {
  return {
    version: 1,
    refId: buildManagedMetadata(testCase).refId,
    fileType: "Document",
    purpose: "Work",
    lifecycle: "Active",
    context: "synthetic benchmark context",
    riskLevel: "Normal",
    suggestedAction: "Keep",
    confidence: 0.91,
    reason: "synthetic benchmark reason",
    keywords: ["synthetic"],
    requiresConfirmation: false,
    ...overrides
  };
}

describe("ZenDecisionBench initial corpus", () => {
  it("is the frozen 180-case six-task corpus with the Phase 1 pilot minimum", async () => {
    const records = await readJsonl(corpusPath);
    const validation = validateDataset(records);
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
    expect(validation.dataset_hash).toBe("d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68");
  });

  it("contains only synthetic provenance and does not treat non-gold abstention as correct by construction", async () => {
    const records = await readJsonl(corpusPath);
    const allowedSources = new Set([
      "zdb-initial-corpus-v1",
      "zdb-initial-corpus-v1-pilot-expansion"
    ]);
    expect(records.every((record) =>
      record.provenance.category === "synthetic"
      && allowedSources.has(record.provenance.source)
    )).toBe(true);

    const abstainAllowed = records
      .filter((record) => record.abstain_allowed)
      .map((record) => record.case_id);
    expect(abstainAllowed).toEqual(["folder-02", "folder-15", "folder-19", "folder-20", "folder-28", "folder-29", "folder-30"]);
    expect(records.filter((record) => record.abstain_allowed).every((record) => record.gold === "abstain")).toBe(true);
  });

  it("covers production canonical semantic choices rather than a benchmark-only subset", async () => {
    const records = await readJsonl(corpusPath);
    const choiceIds = (task) => records.find((record) => record.task === task).choices.map((choice) => choice.id);

    expect(choiceIds("purpose")).toEqual([
      "project", "teaching", "study", "work", "personal", "career", "finance", "identity",
      "media", "installer", "temporary", "archive", "document", "duplicate_review", "unknown"
    ]);
    expect(choiceIds("lifecycle")).toEqual([
      "inbox", "active", "reference", "archive", "disposable", "duplicate", "sensitive", "trash_review", "unknown"
    ]);
    expect(choiceIds("risk_level")).toEqual(["normal", "sensitive", "system", "caution", "unknown"]);
    expect(choiceIds("suggested_action")).toEqual([
      "keep", "rename", "move", "move_and_rename", "archive", "review", "delete_candidate", "unknown"
    ]);
  });
});

describe("Managed AI DeepSeek baseline adapter", () => {
  it("mirrors the production metadata-only request and never sends benchmark choices", async () => {
    const cases = await byId();
    const testCase = cases.get("domain-01");
    const request = buildDeepSeekRequest(testCase);
    const userPayload = JSON.parse(request.body.messages[1].content);

    expect(metadata.default_model).toBe("deepseek-v4-flash");
    expect(request.body.model).toBe("deepseek-v4-flash");
    expect(request.body.temperature).toBe(0);
    expect(request.body.max_tokens).toBe(4096);
    expect(request.body.response_format).toEqual({ type: "json_object" });
    expect(request.body.thinking).toEqual({ type: "disabled" });
    expect(request.body.messages[0].content).toContain("SemanticAssessmentV1");
    expect(userPayload).toEqual({
      refId: "managed:zdb-domain-01",
      name: "lecture-notes.pdf",
      extension: "pdf",
      size: 100000,
      modifiedAt: 1758364800,
      isDirectory: false,
      parent: "C:/ZDB/Study/Database"
    });
    expect(request.body.messages[1].content).not.toContain("choices");
    expect(request.body.messages[1].content).not.toContain("gold");
    expect(request.body.messages[1].content).not.toContain("candidate_folders");
  });

  it("omits parent path for protected system locations exactly like Managed AI", async () => {
    const cases = await byId();
    const metadataInput = buildManagedMetadata(cases.get("risk-09"));
    expect(metadataInput.name).toBe("kernel32.dll");
    expect(metadataInput).not.toHaveProperty("parent");
  });

  it("maps canonical SemanticAssessmentV1 fields to each ZDB decision family", async () => {
    const cases = await byId();
    expect(assessmentToDecision(
      cases.get("domain-01"),
      assessment(cases.get("domain-01"), { fileType: "ArchivePackage" })
    ).decision).toBe("archive_package");
    expect(assessmentToDecision(
      cases.get("purpose-01"),
      assessment(cases.get("purpose-01"), { purpose: "Teaching" })
    ).decision).toBe("teaching");
    expect(assessmentToDecision(
      cases.get("lifecycle-01"),
      assessment(cases.get("lifecycle-01"), { lifecycle: "TrashReview" })
    ).decision).toBe("trash_review");
    expect(assessmentToDecision(
      cases.get("risk-01"),
      assessment(cases.get("risk-01"), { riskLevel: "high" })
    ).decision).toBe("caution");
    expect(assessmentToDecision(
      cases.get("action-01"),
      assessment(cases.get("action-01"), { suggestedAction: "MoveAndRename", targetTemplate: "Work" })
    ).decision).toBe("move_and_rename");
  });

  it("applies production safety downgrade before scoring suggested action", async () => {
    const cases = await byId();
    const testCase = cases.get("action-03");

    expect(assessmentToDecision(
      testCase,
      assessment(testCase, {
        riskLevel: "Sensitive",
        suggestedAction: "Move",
        targetTemplate: "Work/Reports"
      })
    ).decision).toBe("review");

    expect(assessmentToDecision(
      testCase,
      assessment(testCase, {
        suggestedAction: "Move",
        targetTemplate: "../outside"
      })
    ).decision).toBe("review");

    expect(assessmentToDecision(
      testCase,
      assessment(testCase, {
        suggestedAction: "MoveAndRename",
        targetTemplate: "Work/Reports",
        suggestedName: "report.exe"
      })
    ).decision).toBe("review");
  });

  it("maps targetTemplate to an existing folder only after the provider response", async () => {
    const cases = await byId();
    const testCase = cases.get("folder-01");

    expect(assessmentToDecision(
      testCase,
      assessment(testCase, {
        purpose: "Teaching",
        suggestedAction: "Move",
        targetTemplate: "Teaching/Scala"
      })
    ).decision).toBe("folder_1");

    expect(assessmentToDecision(
      testCase,
      assessment(testCase, {
        purpose: "Teaching",
        suggestedAction: "Move",
        targetTemplate: "Teaching/Other"
      })
    ).decision).toBe("abstain");
  });

  it("parses raw final JSON exactly like Managed AI and rejects fenced output", async () => {
    const cases = await byId();
    const testCase = cases.get("purpose-01");
    const clean = assessment(testCase, { purpose: "Teaching" });

    const rawJsonResponse = {
      choices: [{ message: { content: JSON.stringify(clean) } }]
    };
    expect(parseProviderResponse(testCase, rawJsonResponse).decision).toBe("teaching");

    const fencedResponse = {
      choices: [{
        message: {
          content: `\`\`\`json\n${JSON.stringify(clean)}\n\`\`\``
        }
      }]
    };
    expect(() => parseProviderResponse(testCase, fencedResponse)).toThrow();

    const extra = { ...clean, operationId: "op-1" };
    expect(() => assessmentToDecision(testCase, extra)).toThrow(/managed_ai_unknown_field/u);
  });

  it("accepts only the exact legacy V0 envelope that production still migrates", async () => {
    const cases = await byId();
    const testCase = cases.get("purpose-05");
    const v0 = {
      refId: buildManagedMetadata(testCase).refId,
      fileType: "Document",
      purpose: "Work",
      lifecycle: "Active",
      riskLevel: "Normal",
      suggestedAction: "Keep",
      confidence: 0.9,
      reason: "legacy compatible result"
    };
    expect(assessmentToDecision(testCase, v0).decision).toBe("work");

    expect(() => assessmentToDecision(testCase, {
      ...v0,
      context: "V1-only field on V0"
    })).toThrow(/managed_ai_unknown_field/u);
  });

  it("reports the actual environment-overridden live configuration without exposing credentials", () => {
    const previousModel = process.env.ZDB_DEEPSEEK_MODEL;
    const previousBase = process.env.ZDB_DEEPSEEK_BASE_URL;
    const previousPath = process.env.ZDB_DEEPSEEK_CHAT_PATH;
    const previousTimeout = process.env.ZDB_PROVIDER_TIMEOUT_MS;
    try {
      process.env.ZDB_DEEPSEEK_MODEL = "deepseek-test-model";
      process.env.ZDB_DEEPSEEK_BASE_URL = "https://example.com/v1";
      process.env.ZDB_DEEPSEEK_CHAT_PATH = "/custom/chat";
      process.env.ZDB_PROVIDER_TIMEOUT_MS = "54321";

      const run = describeRun();
      expect(run.model).toBe("deepseek-test-model");
      expect(run.endpoint_origin).toBe("https://example.com");
      expect(run.chat_path).toBe("/custom/chat");
      expect(run.timeout_ms).toBe(54321);
      expect(run.prompt_template_sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(run.credential_env).toBe("DEEPSEEK_API_KEY");
      expect(JSON.stringify(run)).not.toContain(process.env.DEEPSEEK_API_KEY ?? "__missing__");
    } finally {
      if (previousModel === undefined) delete process.env.ZDB_DEEPSEEK_MODEL;
      else process.env.ZDB_DEEPSEEK_MODEL = previousModel;
      if (previousBase === undefined) delete process.env.ZDB_DEEPSEEK_BASE_URL;
      else process.env.ZDB_DEEPSEEK_BASE_URL = previousBase;
      if (previousPath === undefined) delete process.env.ZDB_DEEPSEEK_CHAT_PATH;
      else process.env.ZDB_DEEPSEEK_CHAT_PATH = previousPath;
      if (previousTimeout === undefined) delete process.env.ZDB_PROVIDER_TIMEOUT_MS;
      else process.env.ZDB_PROVIDER_TIMEOUT_MS = previousTimeout;
    }
  });

  it("captures measured provider token usage and response model without persisting response bodies", async () => {
    const cases = await byId();
    const testCase = cases.get("purpose-01");
    const previousKey = process.env.DEEPSEEK_API_KEY;
    const previousFetch = globalThis.fetch;
    process.env.DEEPSEEK_API_KEY = "zdb-test-key";
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        model: "deepseek-v4-flash",
        usage: {
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
          prompt_cache_hit_tokens: 2
        },
        choices: [{ message: { content: JSON.stringify(assessment(testCase, { purpose: "Teaching" })) } }]
      })
    });

    try {
      const result = await predict(testCase);
      expect(result.decision).toBe("teaching");
      expect(result.telemetry).toEqual({
        provider_usage: {
          status: "MEASURED_PROVIDER_RESPONSE",
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
          prompt_cache_hit_tokens: 2
        },
        response_model: "deepseek-v4-flash"
      });
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previousKey;
    }
  });

  it("uses stable provider failure codes instead of embedding response bodies", async () => {
    const cases = await byId();
    const testCase = cases.get("purpose-01");
    const previousKey = process.env.DEEPSEEK_API_KEY;
    const previousFetch = globalThis.fetch;
    process.env.DEEPSEEK_API_KEY = "zdb-test-key";
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      text: async () => "provider detail that must not become benchmark evidence"
    });

    try {
      await expect(predict(testCase)).rejects.toThrow(/^provider_http_429$/u);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previousKey;
    }
  });
});
