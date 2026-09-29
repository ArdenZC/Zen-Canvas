import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as baseline from "../adapters/managed-ai-deepseek.mjs";
import * as candidate from "../adapters/managed-ai-deepseek-canonical-enum.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const semanticSource = await readFile(resolve(repositoryRoot, "src-tauri/src/ai/semantic.rs"), "utf8");
const domainTypesSource = await readFile(resolve(repositoryRoot, "src-tauri/src/db/types.rs"), "utf8");

function extractFileTypes(source) {
  const match = source.match(/pub\(crate\) const FILE_TYPES: &\[&str\] = &\[([\s\S]*?)\];/u);
  expect(match, "production FILE_TYPES definition").toBeTruthy();
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
}

function extractDomainEnum(source, name) {
  const match = source.match(new RegExp(`domain_enum!\\(${name}\\s*\\{([\\s\\S]*?)\\}\\);`, "u"));
  expect(match, `production ${name} definition`).toBeTruthy();
  return [...match[1].matchAll(/=>\s*"([^"]+)"/gu)].map((entry) => entry[1]);
}

function extractCanonicalizer(source, name) {
  const match = source.match(new RegExp(`fn ${name}\\([\\s\\S]*?\\n\\}`, "u"));
  expect(match, `production ${name} implementation`).toBeTruthy();
  return match[0];
}

const productionCanonical = {
  fileType: extractFileTypes(semanticSource),
  purpose: extractDomainEnum(domainTypesSource, "Purpose"),
  lifecycle: extractDomainEnum(domainTypesSource, "Lifecycle"),
  riskLevel: extractDomainEnum(domainTypesSource, "RiskLevel"),
  suggestedAction: extractDomainEnum(domainTypesSource, "SuggestedAction")
};

const sourceBoundCase = {
  case_id: "contract-probe",
  task: "suggested_action",
  split: "dev",
  gold: "review",
  choices: [{ id: "choice-a", label: "Sensitive" }],
  input: {
    name: "annual-report.pdf",
    extension: "pdf",
    size: 4096,
    modified_at_fs: 1720000000,
    parent: "F:/Work/Reports"
  }
};

function assessment(overrides = {}) {
  return {
    version: 1,
    refId: "managed:zdb-contract-probe",
    fileType: "Document",
    purpose: "Work",
    lifecycle: "Active",
    context: "",
    riskLevel: "Normal",
    suggestedAction: "Move",
    targetTemplate: "Work/Reports",
    suggestedName: "annual-report.pdf",
    confidence: 0.92,
    reason: "Metadata-only classification.",
    keywords: [],
    requiresConfirmation: false,
    ...overrides
  };
}

describe("ZDB-02 canonical enum contract remediation candidate", () => {
  it("lists every canonical fileType value from the production parser", () => {
    expect(candidate.CANONICAL_ENUMS.fileType).toEqual(productionCanonical.fileType);
    expect(candidate.SYSTEM_PROMPT).toContain(`fileType: ${productionCanonical.fileType.join(" | ")}`);
  });

  it("lists every canonical Purpose value from the production domain enum", () => {
    expect(candidate.CANONICAL_ENUMS.purpose).toEqual(productionCanonical.purpose);
    expect(candidate.SYSTEM_PROMPT).toContain(`purpose: ${productionCanonical.purpose.join(" | ")}`);
    const parser = extractCanonicalizer(semanticSource, "canonical_purpose");
    for (const value of productionCanonical.purpose) expect(parser).toContain(`"${value}"`);
  });

  it("lists every canonical Lifecycle value from the production domain enum", () => {
    expect(candidate.CANONICAL_ENUMS.lifecycle).toEqual(productionCanonical.lifecycle);
    expect(candidate.SYSTEM_PROMPT).toContain(`lifecycle: ${productionCanonical.lifecycle.join(" | ")}`);
    const parser = extractCanonicalizer(semanticSource, "canonical_lifecycle");
    for (const value of productionCanonical.lifecycle) expect(parser).toContain(`"${value}"`);
  });

  it("lists every canonical RiskLevel value from the production domain enum", () => {
    expect(candidate.CANONICAL_ENUMS.riskLevel).toEqual(productionCanonical.riskLevel);
    expect(candidate.SYSTEM_PROMPT).toContain(`riskLevel: ${productionCanonical.riskLevel.join(" | ")}`);
    const parser = extractCanonicalizer(semanticSource, "canonical_risk");
    for (const value of productionCanonical.riskLevel) expect(parser).toContain(`"${value}"`);
  });

  it("lists every canonical SuggestedAction value from the production domain enum", () => {
    expect(candidate.CANONICAL_ENUMS.suggestedAction).toEqual(productionCanonical.suggestedAction);
    expect(candidate.SYSTEM_PROMPT).toContain(`suggestedAction: ${productionCanonical.suggestedAction.join(" | ")}`);
    const parser = extractCanonicalizer(semanticSource, "canonical_action");
    for (const value of productionCanonical.suggestedAction) expect(parser).toContain(`"${value}"`);
  });

  it("adds only the enum contract and keeps examples, labels, and benchmark hints out of the prompt", () => {
    const baselinePrompt = baseline.buildDeepSeekRequest(sourceBoundCase).body.messages[0].content;
    expect(candidate.SYSTEM_PROMPT.startsWith(`${baselinePrompt}\n`)).toBe(true);
    expect(candidate.SYSTEM_PROMPT.slice(baselinePrompt.length + 1)).toContain("Canonical SemanticAssessmentV1 enum values");
    expect(candidate.SYSTEM_PROMPT).not.toMatch(/(?:domain|purpose|lifecycle|risk|action|folder)-\d{2}/iu);
    expect(candidate.SYSTEM_PROMPT).not.toMatch(/\.pdf\s*(?:->|→)|C:\/Teaching|choices|gold|expected answer|dev split|test split/iu);
  });

  it("changes only the system prompt while preserving the baseline request settings and metadata", () => {
    const baseRequest = baseline.buildDeepSeekRequest(sourceBoundCase, { model: "deepseek-v4-flash", maxTokens: 4096 });
    const candidateRequest = candidate.buildDeepSeekRequest(sourceBoundCase, { model: "deepseek-v4-flash", maxTokens: 4096 });
    const candidateBodyWithBasePrompt = structuredClone(candidateRequest.body);
    candidateBodyWithBasePrompt.messages[0].content = baseRequest.body.messages[0].content;

    expect(candidateRequest.expected_ref_id).toBe(baseRequest.expected_ref_id);
    expect(candidateBodyWithBasePrompt).toEqual(baseRequest.body);
    expect(candidateRequest.body.temperature).toBe(0);
    expect(candidateRequest.body.max_tokens).toBe(4096);
    expect(candidateRequest.body.response_format).toEqual({ type: "json_object" });
    expect(candidateRequest.body.thinking).toEqual({ type: "disabled" });
    expect(candidateRequest.body.messages[1].content).toBe(baseRequest.body.messages[1].content);
  });

  it("does not send benchmark choices, gold labels, or split labels to the provider", () => {
    const { body } = candidate.buildDeepSeekRequest(sourceBoundCase);
    const userMetadata = JSON.parse(body.messages[1].content);
    expect(Object.keys(userMetadata).sort()).toEqual(Object.keys(baseline.buildManagedMetadata(sourceBoundCase)).sort());
    expect(userMetadata).not.toHaveProperty("choices");
    expect(userMetadata).not.toHaveProperty("gold");
    expect(userMetadata).not.toHaveProperty("split");
    expect(body.messages[1].content).not.toMatch(/choice-a|annual-report\.pdf.*review|"dev"/iu);
  });

  it("reuses the baseline targetTemplate and suggestedName parser safety behavior", () => {
    expect(candidate.assessmentToDecision).toBe(baseline.assessmentToDecision);
    const safe = candidate.assessmentToDecision(sourceBoundCase, assessment());
    const unsafeTarget = candidate.assessmentToDecision(sourceBoundCase, assessment({ targetTemplate: "../outside" }));
    const unsafeName = candidate.assessmentToDecision(sourceBoundCase, assessment({
      suggestedAction: "Keep",
      suggestedName: "annual-report.exe"
    }));

    expect(safe).toEqual({ decision: "move", confidence: 0.92 });
    expect(unsafeTarget.decision).toBe("review");
    expect(unsafeName.decision).toBe("review");
    expect(unsafeTarget).toEqual(baseline.assessmentToDecision(sourceBoundCase, assessment({ targetTemplate: "../outside" })));
    expect(unsafeName).toEqual(baseline.assessmentToDecision(sourceBoundCase, assessment({
      suggestedAction: "Keep",
      suggestedName: "annual-report.exe"
    })));
  });

  it("reuses the same provider response parser, including fileType failures", () => {
    expect(candidate.parseProviderResponse).toBe(baseline.parseProviderResponse);
    expect(candidate.PROMPT_TEMPLATE_SHA256).not.toBe(baseline.metadata.prompt_template_sha256);
    expect(candidate.PROMPT_TEMPLATE_SHA256).toMatch(/^[a-f0-9]{64}$/u);
    expect(baseline.metadata.adapter_id).toBe("managed-ai-deepseek-v1");
    expect(baseline.metadata.prompt_template_sha256).toBe("5dffff3b88f7fe68e7fa0df6076e136c662fa7fafe8d177358bda5d141a0735a");
    expect(candidate.metadata.base_prompt_template_sha256).toBe(baseline.metadata.prompt_template_sha256);
    expect(() => candidate.assessmentToDecision(sourceBoundCase, assessment({ fileType: "unknown-kind" })))
      .toThrow("managed_ai_invalid_file_type");
  });
});
