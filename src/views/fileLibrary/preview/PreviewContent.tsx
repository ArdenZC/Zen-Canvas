import { File, Folder, LoaderCircle } from "lucide-react";
import type { PreviewMetadata, PreviewSnapshot } from "../../../types/fileWorkspace";
import { formatBytes, formatDate } from "../../../utils/format";
import { useI18nContext } from "../../../contexts/AppContexts";
import type { PreviewExperiencePhase, PreviewExperienceState } from "./previewExperienceController";

export function renderPreviewBody(
  phase: PreviewExperiencePhase,
  source: PreviewExperienceState["source"],
  metadata: PreviewMetadata | null,
  language: Parameters<typeof formatDate>[1],
  t: ReturnType<typeof useI18nContext>["t"],
  snapshot: PreviewSnapshot | null = null
) {
  if (source === null || phase === "no_source") {
    return (
      <div className="zc-floating-preview-status is-terminal" data-preview-no-source="true">
        <strong>{t("previewSelectItem")}</strong>
        <span>{t("previewSelectItemDescription")}</span>
      </div>
    );
  }

  if (phase === "resolving" || phase === "loading") {
    return <div className="zc-floating-preview-status" data-preview-progress="true"><LoaderCircle className="animate-spin" size={22} aria-hidden="true" /><span>{phase === "resolving" ? t("previewResolving") : t("previewLoading")}</span></div>;
  }

  if (phase === "content") {
    const envelope = snapshot?.representation;
    const representation = envelope?.representation;
    if (envelope === undefined || representation === undefined) {
      return <div className="zc-floating-preview-status is-terminal" data-preview-terminal-state="unsupported_representation"><strong>{t("previewUnsupportedRepresentation")}</strong><span>{t("previewRichProviderUnavailable")}</span></div>;
    }
    if (representation.family === "text") {
      return (
        <article
          className="zc-preview-representation zc-preview-text"
          data-preview-representation="text"
          data-preview-completeness={envelope.completeness}
          data-preview-selectable={envelope.capabilities.canSelectText ? "true" : "false"}
        >
          <div className="zc-preview-representation-meta">
            <span>{representation.language ?? t("previewTextContent")}</span>
            {envelope.completeness === "partial" ? <span data-preview-partial="true">{t("previewPartialContent")}</span> : null}
          </div>
          <pre className="zc-preview-text-value">{representation.text}</pre>
        </article>
      );
    }
    if (representation.family === "safe_html") {
      return (
        <article
          className="zc-preview-representation zc-preview-safe-html"
          data-preview-representation="safe_html"
          data-preview-completeness={envelope.completeness}
          data-preview-selectable={envelope.capabilities.canSelectText ? "true" : "false"}
        >
          <div className="zc-preview-representation-meta">
            <span>{t("previewMarkdownContent")}</span>
            {envelope.completeness === "partial" ? <span data-preview-partial="true">{t("previewPartialContent")}</span> : null}
          </div>
          <div className="zc-preview-safe-html-root" dangerouslySetInnerHTML={{ __html: representation.html }} />
        </article>
      );
    }
    return <div className="zc-floating-preview-status is-terminal" data-preview-terminal-state="unsupported_representation"><strong>{t("previewUnsupportedRepresentation")}</strong><span>{t("previewRichProviderUnavailable")}</span></div>;
  }

  if (phase !== "metadata_fallback" && phase !== "unsupported_representation" && phase !== "closed") {
    return <div className="zc-floating-preview-status is-terminal" data-preview-terminal-state={phase}><strong>{terminalTitle(phase, t)}</strong><span>{terminalDescription(phase, t)}</span></div>;
  }

  if (phase === "unsupported_representation") {
    return <div className="zc-floating-preview-status is-terminal" data-preview-terminal-state="unsupported_representation"><strong>{t("previewUnsupportedRepresentation")}</strong><span>{t("previewRichProviderUnavailable")}</span></div>;
  }

  return (
    <div className="zc-floating-preview-metadata" data-preview-metadata="true">
      <div className="zc-floating-preview-entry-icon" aria-hidden="true">
        {source.entryKind === "directory" ? <Folder size={24} /> : <File size={24} />}
      </div>
      <div className="zc-floating-preview-fallback-note"><strong>{t("previewMetadataFallback")}</strong><span>{t("previewMetadataOnlyDescription")}</span></div>
      <dl className="zc-floating-preview-facts">
        <PreviewFact label={t("fileType")} value={metadata?.mediaType ?? source.typeHint ?? t("browseUnknownValue")} />
        <PreviewFact label={t("fileSize")} value={metadata?.sizeBytes === null || metadata?.sizeBytes === undefined ? source.size === undefined ? t("browseUnknownValue") : formatBytes(source.size) : formatBytes(metadata.sizeBytes)} />
        <PreviewFact label={t("fileModified")} value={metadata?.modifiedAtEpochMs === null || metadata?.modifiedAtEpochMs === undefined ? source.modifiedAt === undefined ? t("browseUnknownValue") : formatDate(String(source.modifiedAt), language) : formatDate(String(metadata.modifiedAtEpochMs), language)} />
        <PreviewFact label={t("previewMaterializationLabel")} value={metadata?.materialization ?? source.materialization ?? t("browseUnknownValue")} />
      </dl>
    </div>
  );
}

export function metadataFromSnapshot(snapshot: PreviewSnapshot | null) {
  const representation = snapshot?.representation?.representation;
  return representation?.family === "metadata" ? representation.metadata : null;
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return <div className="zc-floating-preview-fact"><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function terminalTitle(phase: PreviewExperiencePhase, t: ReturnType<typeof useI18nContext>["t"]) {
  switch (phase) {
    case "source_unavailable": return t("previewSourceUnavailable");
    case "materialization_required": return t("previewMaterializationRequired");
    case "permission_denied": return t("previewPermissionDenied");
    case "identity_changed": return t("previewIdentityChanged");
    case "cancelled": return t("previewCancelled");
    case "error": return t("previewError");
    default: return t("previewSourceUnavailable");
  }
}

function terminalDescription(phase: PreviewExperiencePhase, t: ReturnType<typeof useI18nContext>["t"]) {
  switch (phase) {
    case "source_unavailable": return t("previewSourceUnavailableDescription");
    case "materialization_required": return t("previewMaterializationRequiredDescription");
    case "permission_denied": return t("previewPermissionDeniedDescription");
    case "identity_changed": return t("previewIdentityChangedDescription");
    case "cancelled": return t("previewCancelledDescription");
    case "error": return t("previewErrorDescription");
    default: return t("previewSourceUnavailableDescription");
  }
}
