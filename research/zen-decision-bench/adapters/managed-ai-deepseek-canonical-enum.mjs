import { createHash } from "node:crypto";
import * as baseline from "./managed-ai-deepseek.mjs";

export const EXPERIMENT_ID = "zdb-02-canonical-enum-remediation-v1";
export const CONTRACT_SOURCE_COMMIT = "4f53d61fe1a47f62630a56278a39b27a49f52d4e";

export const CANONICAL_ENUMS = Object.freeze({
  fileType: Object.freeze([
    "Document", "Image", "Video", "Audio", "Code", "ArchivePackage", "Installer",
    "Spreadsheet", "Presentation", "Other"
  ]),
  purpose: Object.freeze([
    "Project", "Teaching", "Study", "Work", "Personal", "Career", "Finance", "Identity",
    "Media", "Installer", "Temporary", "Archive", "Document", "Duplicate Review", "Unknown"
  ]),
  lifecycle: Object.freeze([
    "Inbox", "Active", "Reference", "Archive", "Disposable", "Duplicate", "Sensitive",
    "TrashReview", "Unknown"
  ]),
  riskLevel: Object.freeze(["Normal", "Sensitive", "System", "Caution", "Unknown"]),
  suggestedAction: Object.freeze([
    "Keep", "Rename", "Move", "MoveAndRename", "Archive", "Review", "DeleteCandidate", "Unknown"
  ])
});

const promptSeedCase = {
  case_id: "prompt-template",
  task: "domain_type",
  input: { name: "metadata-only", extension: "", size: 0, modified_at_fs: null }
};
const BASE_SYSTEM_PROMPT = baseline.buildDeepSeekRequest(promptSeedCase).body.messages[0].content;
const ENUM_CONTRACT = [
  "Canonical SemanticAssessmentV1 enum values (use exactly one listed value for each field, preserving spelling and capitalization):",
  `fileType: ${CANONICAL_ENUMS.fileType.join(" | ")}`,
  `purpose: ${CANONICAL_ENUMS.purpose.join(" | ")}`,
  `lifecycle: ${CANONICAL_ENUMS.lifecycle.join(" | ")}`,
  `riskLevel: ${CANONICAL_ENUMS.riskLevel.join(" | ")}`,
  `suggestedAction: ${CANONICAL_ENUMS.suggestedAction.join(" | ")}`
].join("\n");

export const SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}\n${ENUM_CONTRACT}`;
export const PROMPT_TEMPLATE_SHA256 = createHash("sha256").update(SYSTEM_PROMPT).digest("hex");

export const metadata = Object.freeze({
  ...baseline.metadata,
  adapter_id: "managed-ai-deepseek-canonical-enum-v1",
  experiment_id: EXPERIMENT_ID,
  prompt_template_id: "managed-ai-semantic-assessment-canonical-enums-v1",
  prompt_template_sha256: PROMPT_TEMPLATE_SHA256,
  base_adapter_id: baseline.metadata.adapter_id,
  base_prompt_template_sha256: baseline.metadata.prompt_template_sha256,
  contract_source_commit: CONTRACT_SOURCE_COMMIT
});

export function assertRunReady() {
  baseline.assertRunReady();
}

export function describeRun() {
  return {
    ...baseline.describeRun(),
    adapter_id: metadata.adapter_id,
    experiment_id: EXPERIMENT_ID,
    prompt_template_id: metadata.prompt_template_id,
    prompt_template_sha256: PROMPT_TEMPLATE_SHA256,
    base_adapter_id: baseline.metadata.adapter_id,
    base_prompt_template_sha256: baseline.metadata.prompt_template_sha256,
    contract_source_commit: CONTRACT_SOURCE_COMMIT
  };
}

export const buildManagedMetadata = baseline.buildManagedMetadata;
export const assessmentToDecision = baseline.assessmentToDecision;
export const parseProviderResponse = baseline.parseProviderResponse;
export const extractOpenAiContent = baseline.extractOpenAiContent;

export function buildDeepSeekRequest(testCase, options = {}) {
  const request = baseline.buildDeepSeekRequest(testCase, options);
  request.body.messages[0].content = SYSTEM_PROMPT;
  return request;
}

function measuredProviderUsage(payload) {
  const usage = payload?.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return { status: "UNAVAILABLE" };
  const fields = [
    "prompt_tokens", "completion_tokens", "total_tokens", "prompt_cache_hit_tokens", "prompt_cache_miss_tokens"
  ];
  const measured = { status: "MEASURED_PROVIDER_RESPONSE" };
  let count = 0;
  for (const field of fields) {
    const value = usage[field];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      measured[field] = value;
      count += 1;
    }
  }
  return count ? measured : { status: "UNAVAILABLE" };
}

export async function predict(testCase) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY_REQUIRED_FOR_LIVE_ZDB_BASELINE");

  const config = describeRun();
  const { expected_ref_id, body } = buildDeepSeekRequest(testCase, {
    model: config.model,
    maxTokens: metadata.max_tokens
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout_ms);
  try {
    let response;
    try {
      response = await fetch(config.endpoint_url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch {
      if (controller.signal.aborted) throw new Error("provider_timeout");
      throw new Error("provider_transport_error");
    }

    const responseText = await response.text();
    if (!response.ok) throw new Error(`provider_http_${response.status}`);

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error("provider_response_invalid_json");
    }

    const decision = parseProviderResponse(testCase, payload, expected_ref_id);
    return {
      ...decision,
      telemetry: {
        provider_usage: measuredProviderUsage(payload),
        response_model: typeof payload?.model === "string" ? payload.model : null
      }
    };
  } finally {
    clearTimeout(timer);
  }
}
