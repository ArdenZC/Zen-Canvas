import { File, Folder, LoaderCircle, X } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";
import { ModalPortal } from "../../../components/modal/ModalPortal";
import { useI18nContext } from "../../../contexts/AppContexts";
import type { PreviewMetadata } from "../../../types/fileWorkspace";
import { formatBytes, formatDate } from "../../../utils/format";
import { buttonSecondary, cn, floatingSurface } from "../../../utils/tw";
import { usePreviewExperience } from "./PreviewExperienceProvider";
import type { PreviewExperiencePhase } from "./previewExperienceController";
import "./zenFloatingQuickPreview.css";

export function ZenFloatingQuickPreview() {
  const { controller, state } = usePreviewExperience();
  const { language, t } = useI18nContext();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  if (!state.visible) return null;

  const source = state.source;
  const metadata = metadataFromSnapshot(state.snapshot);
  const title = source?.displayName ?? t("previewHostTitle");
  const description = source?.source === "browse" ? t("previewBrowseSource") : t("previewLibrarySource");

  return (
    <ModalPortal
      modalId="file-library-floating-preview"
      onEscape={() => controller.close("escape")}
      initialFocusRef={closeRef}
      restoreFocus={() => controller.restoreFocusTarget()}
    >
      <div
        className="zc-floating-preview-backdrop"
        data-preview-host="zen-floating"
        data-preview-shell="true"
        data-preview-state={state.phase}
        data-preview-epoch={state.frontendEpoch}
        data-preview-source={source?.source ?? "none"}
        data-preview-identity={source?.previewSource.kind === "managed"
          ? source.previewSource.fileId
          : source?.previewSource.kind === "ephemeral"
            ? `${source.previewSource.browseSessionId}:${source.previewSource.entryId}`
            : "none"}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) controller.close("button");
        }}
        onKeyDown={(event) => handleHostKeyDown(event, controller.close.bind(controller))}
      >
        <section
          className={cn(floatingSurface, "zc-floating-preview-card")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          data-preview-card="true"
        >
          <header className="zc-floating-preview-header">
            <div className="min-w-0">
              <p className="zc-floating-preview-kicker">{t("previewHostTitle")}</p>
              <h2 id={titleId} className="zc-floating-preview-title" title={title}>{title}</h2>
              <p id={descriptionId} className="zc-floating-preview-description">{description}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="zc-floating-preview-close"
              aria-label={t("libraryPreviewClose")}
              title={t("libraryPreviewClose")}
              onClick={() => controller.close("button")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </header>
          <div className="zc-floating-preview-body" data-preview-content="true">
            {renderPreviewBody(state.phase, source, metadata, language, t)}
          </div>
          <footer className="zc-floating-preview-footer">
            <span className="zc-floating-preview-hint">{t("previewSpaceToClose")}</span>
            <button type="button" className={buttonSecondary} onClick={() => controller.close("button")}>
              {t("libraryPreviewClose")}
            </button>
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}

function renderPreviewBody(
  phase: PreviewExperiencePhase,
  source: ReturnType<typeof usePreviewExperience>["state"]["source"],
  metadata: PreviewMetadata | null,
  language: Parameters<typeof formatDate>[1],
  t: ReturnType<typeof useI18nContext>["t"]
) {
  if (phase === "resolving" || phase === "loading") {
    return <div className="zc-floating-preview-status" data-preview-progress="true"><LoaderCircle className="animate-spin" size={22} aria-hidden="true" /><span>{phase === "resolving" ? t("previewResolving") : t("previewLoading")}</span></div>;
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
        {source?.entryKind === "directory" ? <Folder size={24} /> : <File size={24} />}
      </div>
      <div className="zc-floating-preview-fallback-note"><strong>{t("previewMetadataFallback")}</strong><span>{t("previewMetadataOnlyDescription")}</span></div>
      <dl className="zc-floating-preview-facts">
        <PreviewFact label={t("fileType")} value={metadata?.mediaType ?? source?.typeHint ?? t("browseUnknownValue")} />
        <PreviewFact label={t("fileSize")} value={metadata?.sizeBytes === null || metadata?.sizeBytes === undefined ? source?.size === undefined ? t("browseUnknownValue") : formatBytes(source.size) : formatBytes(metadata.sizeBytes)} />
        <PreviewFact label={t("fileModified")} value={metadata?.modifiedAtEpochMs === null || metadata?.modifiedAtEpochMs === undefined ? source?.modifiedAt === undefined ? t("browseUnknownValue") : formatDate(String(source.modifiedAt), language) : formatDate(String(metadata.modifiedAtEpochMs), language)} />
        <PreviewFact label={t("previewMaterializationLabel")} value={metadata?.materialization ?? source?.materialization ?? t("browseUnknownValue")} />
      </dl>
    </div>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return <div className="zc-floating-preview-fact"><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function metadataFromSnapshot(snapshot: ReturnType<typeof usePreviewExperience>["state"]["snapshot"]) {
  const representation = snapshot?.representation?.representation;
  return representation?.family === "metadata" ? representation.metadata : null;
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

function handleHostKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  close: () => boolean
) {
  if (event.key !== " " && event.key !== "Space") return;
  if (event.nativeEvent.isComposing || event.altKey) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
  event.preventDefault();
  close();
}
