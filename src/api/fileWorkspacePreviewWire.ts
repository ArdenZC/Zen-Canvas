import type {
  ContentReadEligibility,
  MaterializationState,
  PreviewCapabilities,
  PreviewHostKind,
  PreviewMetadata,
  PreviewRepresentation,
  PreviewRepresentationEnvelope,
  PreviewSessionState,
  PreviewSnapshot,
  PreviewSourceRef,
  PreviewTerminalCondition,
  PreviewWarning,
  PreviewRecoverableProviderErrorCode
} from "../types/fileWorkspace";

const MAX_PREVIEW_WIRE_TEXT = 16 * 1024 * 1024;
const MAX_OPAQUE_TOKEN_LENGTH = 4096;

type JsonRecord = Record<string, unknown>;

/**
 * Runtime guard for the Rust Preview wire. TypeScript types alone cannot
 * reject a new family/field arriving from a mismatched backend, so the API
 * adapter fails closed before a future host renders it.
 */
export function parsePreviewSnapshot(value: unknown): PreviewSnapshot {
  const record = asRecord(value, "preview_snapshot_invalid");
  exactKeys(
    record,
    ["previewId", "sessionId", "requestId", "source", "hostKind", "state", "effectiveCapabilities"],
    ["sourceVersion", "representation", "activeProviderId"]
  );
  const hostKind = parseHostKind(record.hostKind);
  const snapshot: PreviewSnapshot = {
    previewId: opaqueId(record.previewId, "preview_id_invalid"),
    sessionId: opaqueId(record.sessionId, "preview_session_id_invalid"),
    requestId: opaqueId(record.requestId, "preview_request_id_invalid"),
    source: parseSourceRef(record.source),
    hostKind,
    state: parseEnum(record.state, [
      "idle",
      "resolving",
      "preparing",
      "loading",
      "ready",
      "failed",
      "cancelled",
      "disposed"
    ], "preview_state_invalid") as PreviewSessionState,
    effectiveCapabilities: parseCapabilities(record.effectiveCapabilities)
  };
  if (record.sourceVersion !== undefined) {
    snapshot.sourceVersion = boundedText(record.sourceVersion, "preview_source_version_invalid");
  }
  if (record.representation !== undefined) {
    snapshot.representation = parseRepresentationEnvelope(record.representation, hostKind);
  }
  if (record.activeProviderId !== undefined) {
    snapshot.activeProviderId = opaqueId(record.activeProviderId, "preview_provider_id_invalid");
  }
  return snapshot;
}

export function parsePreviewRepresentationEnvelope(
  value: unknown,
  hostKind: PreviewHostKind
): PreviewRepresentationEnvelope {
  return parseRepresentationEnvelope(value, hostKind);
}

function parseRepresentationEnvelope(
  value: unknown,
  hostKind: PreviewHostKind
): PreviewRepresentationEnvelope {
  const record = asRecord(value, "preview_representation_envelope_invalid");
  exactKeys(record, ["sourceVersion", "representation", "completeness", "warnings", "capabilities"]);
  return {
    sourceVersion: boundedText(record.sourceVersion, "preview_source_version_invalid"),
    representation: parseRepresentation(record.representation, hostKind),
    completeness: parseEnum(record.completeness, ["complete", "partial", "unknown"], "preview_completeness_invalid") as PreviewRepresentationEnvelope["completeness"],
    warnings: parseWarnings(record.warnings),
    capabilities: parseCapabilities(record.capabilities)
  };
}

function parseRepresentation(value: unknown, hostKind: PreviewHostKind): PreviewRepresentation {
  const record = asRecord(value, "preview_representation_invalid");
  const family = record.family;
  if (typeof family !== "string") throw new Error("preview_representation_family_invalid");
  switch (family) {
    case "metadata": {
      exactKeys(record, ["family", "metadata"]);
      return { family, metadata: parseMetadata(record.metadata) };
    }
    case "text":
      exactKeys(record, ["family", "text", "language"]);
      return {
        family,
        text: boundedText(record.text, "preview_text_invalid"),
        language: record.language === null ? null : boundedText(record.language, "preview_language_invalid")
      };
    case "safe_html":
      exactKeys(record, ["family", "html"]);
      return { family, html: boundedText(record.html, "preview_html_invalid") };
    case "structured_tree":
      exactKeys(record, ["family", "encodedTree"]);
      return { family, encodedTree: boundedText(record.encodedTree, "preview_tree_invalid") };
    case "table":
      exactKeys(record, ["family", "encodedTable"]);
      return { family, encodedTable: boundedText(record.encodedTable, "preview_table_invalid") };
    case "image":
    case "media":
      exactKeys(record, ["family", "assetToken", "mediaType"]);
      return {
        family,
        assetToken: opaqueToken(record.assetToken, "preview_asset_token_invalid"),
        mediaType: boundedText(record.mediaType, "preview_media_type_invalid")
      };
    case "folder_summary":
      exactKeys(record, ["family", "encodedSummary"]);
      return { family, encodedSummary: boundedText(record.encodedSummary, "preview_summary_invalid") };
    case "archive_tree":
      exactKeys(record, ["family", "encodedTree"]);
      return { family, encodedTree: boundedText(record.encodedTree, "preview_tree_invalid") };
    case "native_opaque": {
      exactKeys(record, ["family", "host", "token"]);
      const representationHost = parseHostKind(record.host);
      if (representationHost !== hostKind) throw new Error("preview_native_host_mismatch");
      return {
        family,
        host: representationHost,
        token: opaqueToken(record.token, "preview_native_token_invalid")
      };
    }
    default:
      throw new Error("preview_representation_family_unknown");
  }
}

function parseWarnings(value: unknown): PreviewWarning[] {
  if (!Array.isArray(value)) throw new Error("preview_warnings_invalid");
  return value.map((entry) => {
    const record = asRecord(entry, "preview_warning_invalid");
    switch (record.kind) {
      case "provider_fallback":
        exactKeys(record, ["kind", "providerId", "reason"]);
        return {
          kind: record.kind,
          providerId: opaqueId(record.providerId, "preview_warning_provider_invalid"),
          reason: parseEnum(record.reason, [
            "unsupported",
            "failed",
            "timeout",
            "corrupt_source"
          ], "preview_warning_reason_invalid") as PreviewRecoverableProviderErrorCode
        };
      case "metadata_fallback":
        exactKeys(record, ["kind"]);
        return { kind: record.kind };
      case "terminal_condition":
        exactKeys(record, ["kind", "condition"]);
        return {
          kind: record.kind,
          condition: parseEnum(record.condition, [
            "source_unavailable",
            "materialization_required",
            "permission_denied",
            "identity_changed",
            "cancelled"
          ], "preview_terminal_condition_invalid") as PreviewTerminalCondition
        };
      default:
        throw new Error("preview_warning_kind_unknown");
    }
  });
}

function parseMetadata(value: unknown): PreviewMetadata {
  const record = asRecord(value, "preview_metadata_invalid");
  exactKeys(record, [
    "displayName",
    "mediaType",
    "extension",
    "sizeBytes",
    "modifiedAtEpochMs",
    "materialization",
    "readEligibility"
  ]);
  return {
    displayName: boundedText(record.displayName, "preview_metadata_name_invalid"),
    mediaType: nullableText(record.mediaType, "preview_metadata_media_type_invalid"),
    extension: nullableText(record.extension, "preview_metadata_extension_invalid"),
    sizeBytes: nullableNumber(record.sizeBytes, "preview_metadata_size_invalid"),
    modifiedAtEpochMs: nullableNumber(record.modifiedAtEpochMs, "preview_metadata_modified_invalid"),
    materialization: parseEnum(record.materialization, [
      "local",
      "boundary_readable",
      "metadata_only",
      "remote_placeholder",
      "hydrating",
      "unavailable",
      "unknown"
    ], "preview_metadata_materialization_invalid") as MaterializationState,
    readEligibility: parseEnum(record.readEligibility, [
      "eligible",
      "materialization_required",
      "downloading",
      "metadata_only",
      "permission_required",
      "source_unavailable",
      "source_not_supported",
      "package_unsupported",
      "symlink",
      "identity_changed",
      "availability_unknown"
    ], "preview_metadata_eligibility_invalid") as ContentReadEligibility
  };
}

function parseCapabilities(value: unknown): PreviewCapabilities {
  const record = asRecord(value, "preview_capabilities_invalid");
  const keys = [
    "canSearch",
    "canZoom",
    "canPlayback",
    "canSelectText",
    "canNavigateInternal",
    "canNavigateSiblings",
    "canOpenExternal",
    "canReveal",
    "canRequestMaterialization"
  ];
  exactKeys(record, keys);
  const result = {} as PreviewCapabilities;
  for (const key of keys) {
    if (typeof record[key] !== "boolean") throw new Error("preview_capabilities_invalid");
    (result as unknown as Record<string, boolean>)[key] = record[key] as boolean;
  }
  return result;
}

function parseSourceRef(value: unknown): PreviewSourceRef {
  const record = asRecord(value, "preview_source_invalid");
  switch (record.kind) {
    case "managed":
      exactKeys(record, ["kind", "fileId"]);
      return { kind: record.kind, fileId: opaqueId(record.fileId, "preview_file_id_invalid") };
    case "ephemeral":
      exactKeys(record, ["kind", "browseSessionId", "entryId"]);
      return {
        kind: record.kind,
        browseSessionId: opaqueId(record.browseSessionId, "preview_browse_session_invalid"),
        entryId: opaqueId(record.entryId, "preview_entry_id_invalid")
      };
    case "host_provided":
      exactKeys(record, ["kind", "hostToken"]);
      return { kind: record.kind, hostToken: opaqueToken(record.hostToken, "preview_host_token_invalid") };
    default:
      throw new Error("preview_source_kind_unknown");
  }
}

function parseHostKind(value: unknown): PreviewHostKind {
  return parseEnum(value, [
    "zen_floating",
    "zen_pinned",
    "mac_quick_look_extension",
    "windows_quick_preview",
    "windows_preview_handler"
  ], "preview_host_kind_invalid") as PreviewHostKind;
}

function asRecord(value: unknown, error: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(error);
  return value as JsonRecord;
}

function exactKeys(record: JsonRecord, required: string[], optional: string[] = []) {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !(key in record)) || Object.keys(record).some((key) => !allowed.has(key))) {
    throw new Error("preview_wire_unknown_or_missing_field");
  }
}

function parseEnum(value: unknown, allowed: readonly string[], error: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(error);
  return value;
}

function boundedText(value: unknown, error: string): string {
  if (typeof value !== "string" || value.length > MAX_PREVIEW_WIRE_TEXT) throw new Error(error);
  return value;
}

function nullableText(value: unknown, error: string): string | null {
  return value === null ? null : boundedText(value, error);
}

function nullableNumber(value: unknown, error: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(error);
  return value;
}

function opaqueId(value: unknown, error: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_OPAQUE_TOKEN_LENGTH || value.includes("\0")) {
    throw new Error(error);
  }
  return value;
}

function opaqueToken(value: unknown, error: string): string {
  const token = opaqueId(value, error);
  if (token.includes("/") || token.includes("\\")) throw new Error(error);
  return token;
}
