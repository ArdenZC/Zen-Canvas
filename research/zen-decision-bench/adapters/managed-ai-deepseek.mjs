const PRODUCTION_SYSTEM_PROMPT =
  "Classify one explicitly managed file from metadata only. Return exactly one JSON object for SemanticAssessmentV1: version=1, refId, fileType, purpose, lifecycle, context, riskLevel, suggestedAction, optional relative targetTemplate, optional suggestedName, confidence from 0 to 1, reason, keywords array, and requiresConfirmation. Do not include sourceBinding, filesystem paths, operation IDs, permission claims, tools, or file contents. targetTemplate is only a relative folder hint; never return an absolute path or traversal.";

const FILE_TYPES = ["Document", "Image", "Video", "Audio", "Code", "ArchivePackage", "Installer", "Spreadsheet", "Presentation", "Other"];

const PURPOSES = new Map([
  ["project", "Project"], ["teaching", "Teaching"], ["study", "Study"], ["work", "Work"],
  ["personal", "Personal"], ["career", "Career"], ["finance", "Finance"], ["identity", "Identity"],
  ["media", "Media"], ["installer", "Installer"], ["temporary", "Temporary"], ["archive", "Archive"],
  ["document", "Document"], ["duplicatereview", "Duplicate Review"], ["unknown", "Unknown"]
]);

const LIFECYCLES = new Map([
  ["inbox", "Inbox"], ["active", "Active"], ["reference", "Reference"], ["archive", "Archive"],
  ["disposable", "Disposable"], ["duplicate", "Duplicate"], ["sensitive", "Sensitive"],
  ["trashreview", "TrashReview"], ["unknown", "Unknown"]
]);

const RISKS = new Map([
  ["low", "Normal"], ["normal", "Normal"], ["sensitive", "Sensitive"], ["system", "System"],
  ["medium", "Caution"], ["high", "Caution"], ["caution", "Caution"], ["unknown", "Unknown"]
]);

const ACTIONS = new Map([
  ["keep", "Keep"], ["rename", "Rename"], ["move", "Move"], ["moveandrename", "MoveAndRename"],
  ["archive", "Archive"], ["review", "Review"], ["deletecandidate", "DeleteCandidate"],
  ["delete", "DeleteCandidate"], ["unknown", "Unknown"]
]);

const ALLOWED_KEYS = new Set([
  "version", "refId", "fileType", "purpose", "lifecycle", "context", "riskLevel",
  "suggestedAction", "targetTemplate", "suggestedName", "confidence", "reason",
  "keywords", "requiresConfirmation"
]);

export const metadata = Object.freeze({
  adapter_id: "managed-ai-deepseek-v1",
  evidence_status: "LIVE_PROVIDER_REQUIRED",
  production_contract: "ManagedAiWorker SemanticAssessmentV1 metadata-only request",
  provider: "deepseek_openai_compatible",
  default_base_url: "https://api.deepseek.com",
  default_chat_path: "/chat/completions",
  default_model: "deepseek-v4-flash",
  temperature: 0,
  max_tokens: 4096,
  thinking: "disabled",
  response_format: "json_object"
});

function normalizedEnum(value) {
  return String(value ?? "")
    .split("")
    .filter((character) => /[A-Za-z0-9]/u.test(character))
    .join("")
    .toLowerCase();
}

function canonicalFileType(value) {
  const normalized = normalizedEnum(value);
  return FILE_TYPES.find((candidate) => normalizedEnum(candidate) === normalized) ?? null;
}

function canonicalFrom(map, value) {
  return map.get(normalizedEnum(value)) ?? "Unknown";
}

function normalizePath(path) {
  return String(path ?? "").replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
}

function isSystemPath(path) {
  const normalized = normalizePath(path);
  return [
    "/system",
    "/library",
    "/private",
    "/usr",
    "/bin",
    "/sbin",
    "/etc",
    "/var",
    "/opt",
    "/dev",
    "c:/windows",
    "c:/program files",
    "c:/programdata",
    "c:/recovery",
    "c:/system volume information"
  ].some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function validTargetTemplate(value) {
  if (typeof value !== "string" || !value || value.length > 512) return false;
  if (value.startsWith("/") || value.startsWith("\\") || value.includes("\\") || value.includes(":")) return false;
  if ([...value].some((character) => /[\u0000-\u001F\u007F]/u.test(character))) return false;
  const segments = value.split("/");
  if (!segments.length) return false;
  return segments.every((segment) => {
    if (!segment || segment === "." || segment === ".." || [...segment].length > 120) return false;
    if (/[<>"|?*]/u.test(segment) || /[. ]$/u.test(segment)) return false;
    const base = segment.split(".")[0].replace(/[. ]+$/u, "").toUpperCase();
    if (["CON", "PRN", "AUX", "NUL"].includes(base)) return false;
    if (/^(COM|LPT)[1-9]$/u.test(base)) return false;
    return true;
  });
}

function normalizeFolder(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

function fileExtension(name) {
  const leaf = String(name).split(/[\\/]/u).at(-1) ?? "";
  const dot = leaf.lastIndexOf(".");
  if (dot <= 0 || dot + 1 >= leaf.length) return null;
  return leaf.slice(dot + 1);
}

function normalizeProposedFileName(originalName, indexedExtension, proposedName) {
  const proposed = String(proposedName).trim() || String(originalName).trim();
  if (!proposed || proposed === "." || proposed === ".." || proposed.includes("..")
      || /[. ]$/u.test(proposed) || /[\\/\u0000-\u001F\u007F<>:"|?*]/u.test(proposed)) {
    throw new Error("unsafe_proposed_name");
  }
  const indexed = String(indexedExtension ?? "").trim().replace(/^\./u, "");
  const proposedExtension = fileExtension(proposed);
  if (!proposedExtension) {
    return indexed ? `${proposed}.${fileExtension(originalName) ?? indexed}` : proposed;
  }
  if (!indexed || proposedExtension.toLowerCase() !== indexed.toLowerCase()) throw new Error("extension_change");
  const stem = proposed.slice(0, proposed.length - proposedExtension.length - 1);
  return `${stem}.${fileExtension(originalName) ?? indexed}`;
}

function assertText(field, value, maxChars, allowEmpty) {
  if (typeof value !== "string") throw new Error(`managed_ai_invalid_${field}`);
  if ((!allowEmpty && !value.trim()) || [...value].length > maxChars || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new Error(`managed_ai_invalid_${field}`);
  }
}

function cleanJsonText(content) {
  let text = String(content ?? "").replace(/<think>[\s\S]*?<\/think>/giu, "").trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  }
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length) text = text.slice(Math.min(...starts));

  let depth = 0;
  let inString = false;
  let escaped = false;
  const expected = [];
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") {
      if (start < 0) start = index;
      depth += 1;
      expected.push(character === "{" ? "}" : "]");
      continue;
    }
    if ((character === "}" || character === "]") && depth > 0 && expected.at(-1) === character) {
      expected.pop();
      depth -= 1;
      if (depth === 0 && start >= 0) return text.slice(start, index + 1);
    }
  }
  return text.trim();
}

function extractTextPart(value) {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => typeof part?.text === "string" ? part.text : "")
      .join("");
    if (joined.trim()) return joined;
  }
  return null;
}

export function extractOpenAiContent(response) {
  const first = response?.choices?.[0];
  const message = first?.message;
  for (const candidate of [
    message?.content,
    message?.output_text,
    message?.text,
    response?.output_text,
    response?.content
  ]) {
    const extracted = extractTextPart(candidate);
    if (extracted) return extracted;
  }
  const reasoning = extractTextPart(message?.reasoning_content) ?? extractTextPart(message?.reasoning_details);
  if (reasoning) throw new Error("provider_returned_reasoning_without_final_content");
  throw new Error("provider_response_missing_content");
}

export function buildManagedMetadata(testCase) {
  const refId = `managed:zdb-${testCase.case_id}`;
  const metadata = {
    refId,
    name: testCase.input.name,
    extension: testCase.input.extension,
    size: testCase.input.size,
    modifiedAt: testCase.input.modified_at_fs ?? null,
    isDirectory: false
  };
  const parent = testCase.input.parent;
  if (typeof parent === "string" && parent && !isSystemPath(parent)) metadata.parent = parent;
  return metadata;
}

export function buildDeepSeekRequest(testCase, options = {}) {
  const metadataInput = buildManagedMetadata(testCase);
  const model = options.model ?? "deepseek-v4-flash";
  return {
    expected_ref_id: metadataInput.refId,
    body: {
      model,
      messages: [
        { role: "system", content: PRODUCTION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(metadataInput) }
      ],
      temperature: 0,
      max_tokens: Math.min(Number(options.maxTokens ?? 4096), 4096),
      response_format: { type: "json_object" },
      thinking: { type: "disabled" }
    }
  };
}

function canonicalizeAssessment(raw, expectedRef, sourceName, sourceExtension) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("managed_ai_invalid_json_object");
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) throw new Error(`managed_ai_unknown_field:${key}`);
  }
  for (const key of [
    "version", "refId", "fileType", "purpose", "lifecycle", "context", "riskLevel",
    "suggestedAction", "confidence", "reason", "requiresConfirmation"
  ]) {
    if (!(key in raw)) throw new Error(`managed_ai_missing_field:${key}`);
  }
  if (raw.version !== 1) throw new Error("managed_ai_unsupported_semantic_version");
  if (raw.refId !== expectedRef) throw new Error("managed_ai_ref_id_mismatch");
  if (typeof raw.confidence !== "number" || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
    throw new Error("managed_ai_confidence_out_of_range");
  }
  assertText("reason", raw.reason, 512, false);
  assertText("context", raw.context, 512, true);
  if (raw.keywords !== undefined) {
    if (!Array.isArray(raw.keywords) || raw.keywords.length > 16) throw new Error("managed_ai_keywords_invalid");
    for (const keyword of raw.keywords) assertText("keyword", keyword, 80, false);
  }
  if (typeof raw.requiresConfirmation !== "boolean") throw new Error("managed_ai_requires_confirmation_invalid");

  const fileType = canonicalFileType(raw.fileType);
  if (!fileType) throw new Error("managed_ai_invalid_file_type");
  const purpose = canonicalFrom(PURPOSES, raw.purpose);
  const lifecycle = canonicalFrom(LIFECYCLES, raw.lifecycle);
  const riskLevel = canonicalFrom(RISKS, raw.riskLevel);
  let suggestedAction = canonicalFrom(ACTIONS, raw.suggestedAction);
  if (raw.targetTemplate != null && typeof raw.targetTemplate !== "string") throw new Error("managed_ai_invalid_target_template_type");
  if (raw.suggestedName != null && typeof raw.suggestedName !== "string") throw new Error("managed_ai_invalid_suggested_name_type");
  let targetTemplate = raw.targetTemplate == null ? null : raw.targetTemplate;
  let suggestedName = raw.suggestedName == null ? null : raw.suggestedName;
  let requiresConfirmation = raw.requiresConfirmation;
  let forceReview = [purpose, lifecycle, riskLevel, suggestedAction].includes("Unknown");

  if (targetTemplate !== null && !validTargetTemplate(targetTemplate)) {
    targetTemplate = null;
    forceReview = true;
  }
  if (suggestedName !== null) {
    try {
      if ([...suggestedName].length > 255) throw new Error("name_too_long");
      suggestedName = normalizeProposedFileName(sourceName, sourceExtension, suggestedName);
    } catch {
      suggestedName = null;
      forceReview = true;
    }
  }
  if (["Move", "MoveAndRename", "Archive"].includes(suggestedAction) && targetTemplate === null) forceReview = true;
  if (riskLevel !== "Normal") forceReview = true;
  if (forceReview) {
    suggestedAction = "Review";
    requiresConfirmation = true;
  }
  if (raw.confidence < 0.8 || ["Review", "DeleteCandidate"].includes(suggestedAction)) requiresConfirmation = true;

  return {
    fileType,
    purpose,
    lifecycle,
    riskLevel,
    suggestedAction,
    targetTemplate,
    confidence: raw.confidence,
    requiresConfirmation
  };
}

function snake(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replaceAll(" ", "_")
    .toLowerCase();
}

export function assessmentToDecision(testCase, rawAssessment, expectedRef = buildManagedMetadata(testCase).refId) {
  const assessment = canonicalizeAssessment(
    rawAssessment,
    expectedRef,
    testCase.input.name,
    testCase.input.extension
  );
  let decision;
  switch (testCase.task) {
    case "domain_type":
      decision = snake(assessment.fileType);
      break;
    case "purpose":
      decision = snake(assessment.purpose);
      break;
    case "lifecycle":
      decision = snake(assessment.lifecycle);
      break;
    case "risk_level":
      decision = snake(assessment.riskLevel);
      break;
    case "suggested_action":
      decision = snake(assessment.suggestedAction);
      break;
    case "existing_folder_choice": {
      const target = normalizeFolder(assessment.targetTemplate);
      decision = target
        ? testCase.choices.find((choice) => normalizeFolder(choice.label) === target)?.id ?? "abstain"
        : "abstain";
      break;
    }
    default:
      throw new Error(`unsupported_zdb_task:${testCase.task}`);
  }
  return { decision, confidence: assessment.confidence };
}

export function parseProviderResponse(testCase, providerResponse, expectedRef = buildManagedMetadata(testCase).refId) {
  const content = extractOpenAiContent(providerResponse);
  const raw = JSON.parse(cleanJsonText(content));
  return assessmentToDecision(testCase, raw, expectedRef);
}

function joinUrl(baseUrl, chatPath) {
  return `${String(baseUrl).replace(/\/+$/u, "")}/${String(chatPath).replace(/^\/+/, "")}`;
}

export async function predict(testCase) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY_REQUIRED_FOR_LIVE_ZDB_BASELINE");

  const baseUrl = process.env.ZDB_DEEPSEEK_BASE_URL?.trim() || metadata.default_base_url;
  const chatPath = process.env.ZDB_DEEPSEEK_CHAT_PATH?.trim() || metadata.default_chat_path;
  const model = process.env.ZDB_DEEPSEEK_MODEL?.trim() || metadata.default_model;
  const timeoutMs = Math.max(1, Number(process.env.ZDB_PROVIDER_TIMEOUT_MS ?? 120000));
  const { expected_ref_id, body } = buildDeepSeekRequest(testCase, { model, maxTokens: 4096 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(joinUrl(baseUrl, chatPath), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`provider_http_${response.status}:${responseText.slice(0, 500)}`);
    const payload = JSON.parse(responseText);
    return parseProviderResponse(testCase, payload, expected_ref_id);
  } finally {
    clearTimeout(timer);
  }
}
