import { Info, Pin, X } from "lucide-react";
import { useCallback, useEffect, useId, useState, type RefObject } from "react";
import { tauriApi } from "../../../api/tauriApi";
import { useI18nContext } from "../../../contexts/AppContexts";
import { buttonSecondary, cn, floatingSurface } from "../../../utils/tw";
import { usePreviewExperience } from "./PreviewExperienceProvider";
import {
  metadataFromSnapshot,
  previewStateAnnouncement,
  renderPreviewBody,
  usePreviewImagePresentation,
  usePreviewPdfPresentation
} from "./PreviewContent";
import { PreviewNavigation } from "./PreviewNavigation";
import { previewPresentationState } from "./previewExperienceController";
import type { PreviewAssetRequest, PreviewNativePresentation, PreviewSnapshot } from "../../../types/fileWorkspace";
import { formatBytes, formatDate } from "../../../utils/format";

export function ZenQuickPreviewSurface({
  mode,
  closeRef,
  onClose
}: {
  mode: "floating" | "pinned";
  closeRef?: RefObject<HTMLButtonElement | null>;
  onClose?: () => void;
}) {
  const { controller, state } = usePreviewExperience();
  const { language, t } = useI18nContext();
  const titleId = useId();
  const descriptionId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const requestPreviewAsset = useCallback(
    (request: PreviewAssetRequest) => controller.requestPreviewAsset(request),
    [controller]
  );
  const updateNativePreviewGeometry = useCallback(
    (previewId: string, presentation: PreviewNativePresentation) => controller.updateNativePreviewGeometry(previewId, presentation),
    [controller]
  );
  const imagePresentation = usePreviewImagePresentation(state.snapshot, state.source);
  const pdfPresentation = usePreviewPdfPresentation(state.snapshot, state.source);

  useEffect(() => {
    setDetailsOpen(false);
  }, [mode, state.source?.key]);

  if (!state.visible || state.host !== mode) return null;

  const source = state.source;
  const metadata = metadataFromSnapshot(state.snapshot);
  const title = source?.displayName ?? (mode === "pinned" ? t("previewPinnedTitle") : t("previewHostTitle"));
  const description = source?.source === "browse" ? t("previewBrowseSource") : t("previewLibrarySource");
  const fileType = metadata?.mediaType ?? source?.typeHint ?? source?.extension ?? source?.entryKind ?? "-";
  const fileSize = metadata?.sizeBytes ?? source?.size;
  const modifiedAt = metadata?.modifiedAtEpochMs ?? source?.modifiedAt;
  const canReveal = source?.previewSource.kind === "managed" && Boolean(state.snapshot?.effectiveCapabilities.canReveal);
  const navigationLabel = state.navigation === null
    ? fileType
    : fileType + " · " + (state.navigation.currentIndex + 1) + " / " + state.navigation.loadedCount;
  const closePreview = onClose ?? (() => controller.close("button"));

  async function revealCurrentFile() {
    if (!canReveal || source?.previewSource.kind !== "managed") return;
    await tauriApi.revealFileLibraryEntry(source.previewSource.fileId).catch(() => undefined);
  }

  return (
    <section
      className={cn(floatingSurface, "zc-floating-preview-card")}
      role="dialog"
      aria-modal={mode === "floating" ? "true" : "false"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-preview-card="true"
      data-preview-surface-mode={mode}
      data-preview-details-open={detailsOpen ? "true" : "false"}
      data-preview-state={state.phase}
      data-preview-content-state={previewPresentationState(state.phase, state.snapshot, imagePresentation.state, pdfPresentation.state)}
      data-preview-epoch={state.frontendEpoch}
      data-preview-source={source?.source ?? "none"}
      data-preview-identity={source?.previewSource.kind === "managed"
        ? source.previewSource.fileId
        : source?.previewSource.kind === "ephemeral"
          ? source.previewSource.browseSessionId + ":" + source.previewSource.entryId
          : "none"}
    >
      <QuickPreviewHeader
        mode={mode}
        title={title}
        navigationLabel={navigationLabel}
        titleId={titleId}
        descriptionId={descriptionId}
        detailsOpen={detailsOpen}
        closeRef={closeRef}
        onDetailsToggle={() => setDetailsOpen((open) => !open)}
        onUnpin={() => void controller.unpin()}
        onPin={() => void controller.pin()}
        onClose={closePreview}
        t={t}
      />
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-preview-state-announcement="true"
      >
        {previewStateAnnouncement(state.phase, t, state.snapshot, imagePresentation.state, pdfPresentation.state)}
      </div>
      <QuickPreviewViewport
        detailsOpen={detailsOpen}
        source={source}
        metadata={metadata}
        language={language}
        t={t}
        state={state}
        requestPreviewAsset={requestPreviewAsset}
        updateNativePreviewGeometry={updateNativePreviewGeometry}
        imagePresentation={imagePresentation}
        pdfPresentation={pdfPresentation}
        fileType={fileType}
        fileSize={fileSize}
        modifiedAt={modifiedAt}
      />
      <QuickPreviewFooter
        mode={mode}
        status={previewStateAnnouncement(state.phase, t, state.snapshot, imagePresentation.state, pdfPresentation.state)}
        canReveal={canReveal}
        onReveal={() => void revealCurrentFile()}
        onClose={closePreview}
        t={t}
      />
    </section>
  );
}

function QuickPreviewHeader({
  mode,
  title,
  navigationLabel,
  titleId,
  descriptionId,
  detailsOpen,
  closeRef,
  onDetailsToggle,
  onUnpin,
  onPin,
  onClose,
  t
}: {
  mode: "floating" | "pinned";
  title: string;
  navigationLabel: string;
  titleId: string;
  descriptionId: string;
  detailsOpen: boolean;
  closeRef?: RefObject<HTMLButtonElement | null>;
  onDetailsToggle: () => void;
  onUnpin: () => void;
  onPin: () => void;
  onClose: () => void;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  return (
    <header className="zc-floating-preview-header">
      <div className="zc-floating-preview-header-navigation">
        <PreviewNavigation compact />
      </div>
      <div className="zc-floating-preview-header-title min-w-0">
        <h2 id={titleId} className="zc-floating-preview-title" title={title}>{title}</h2>
        <p className="zc-floating-preview-title-meta">{navigationLabel}</p>
        <p id={descriptionId} className="sr-only">{t("previewFileInfo")}</p>
      </div>
      <div className="zc-floating-preview-header-actions">
        <button
          type="button"
          className="zc-floating-preview-action"
          aria-label={t("previewFileInfo")}
          title={t("previewFileInfo")}
          aria-expanded={detailsOpen}
          aria-controls="quick-preview-details"
          data-preview-details-toggle="true"
          onClick={onDetailsToggle}
        >
          <Info size={15} aria-hidden="true" />
          <span className="sr-only">{t("previewFileInfo")}</span>
        </button>
        <button
          type="button"
          className="zc-floating-preview-action"
          aria-label={mode === "pinned" ? t("previewUnpin") : t("previewPin")}
          title={mode === "pinned" ? t("previewUnpin") : t("previewPin")}
          aria-pressed={mode === "pinned"}
          data-preview-pin="true"
          data-preview-pin-state={mode}
          onClick={mode === "pinned" ? onUnpin : onPin}
        >
          <Pin size={15} aria-hidden="true" />
          <span className="sr-only">{mode === "pinned" ? t("previewUnpin") : t("previewPin")}</span>
        </button>
        <button
          ref={closeRef}
          type="button"
          className="zc-floating-preview-close"
          aria-label={t("libraryPreviewClose")}
          title={t("libraryPreviewClose")}
          onClick={onClose}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function QuickPreviewViewport({
  detailsOpen,
  source,
  metadata,
  language,
  t,
  state,
  requestPreviewAsset,
  updateNativePreviewGeometry,
  imagePresentation,
  pdfPresentation,
  fileType,
  fileSize,
  modifiedAt
}: {
  detailsOpen: boolean;
  source: ReturnType<typeof usePreviewExperience>["state"]["source"];
  metadata: ReturnType<typeof metadataFromSnapshot>;
  language: Parameters<typeof formatDate>[1];
  t: ReturnType<typeof useI18nContext>["t"];
  state: ReturnType<typeof usePreviewExperience>["state"];
  requestPreviewAsset: (request: PreviewAssetRequest) => Promise<import("../../../types/fileWorkspace").PreviewAssetArtifact>;
  updateNativePreviewGeometry: (previewId: string, presentation: PreviewNativePresentation) => Promise<PreviewSnapshot | null>;
  imagePresentation: ReturnType<typeof usePreviewImagePresentation>;
  pdfPresentation: ReturnType<typeof usePreviewPdfPresentation>;
  fileType: string;
  fileSize: number | undefined;
  modifiedAt: number | undefined;
}) {
  return (
    <div
      className="zc-floating-preview-body"
      data-preview-content="true"
      data-preview-details-open={detailsOpen ? "true" : "false"}
    >
      <div className="zc-floating-preview-content">
        {renderPreviewBody(
          state.phase,
          source,
          metadata,
          language,
          t,
          state.snapshot,
          requestPreviewAsset,
          updateNativePreviewGeometry,
          imagePresentation.publish,
          pdfPresentation.publish
        )}
      </div>
      {detailsOpen ? (
        <aside id="quick-preview-details" className="zc-floating-preview-inspector" aria-label={t("previewFileInfo")}>
          <h3>{t("previewFileInfo")}</h3>
          <dl>
            <PreviewFact label={t("previewFileType")} value={fileType} />
            <PreviewFact label={t("previewFileSize")} value={fileSize === undefined ? "-" : formatBytes(fileSize)} />
            <PreviewFact label={t("previewFileModified")} value={modifiedAt === undefined ? "-" : formatDate(String(modifiedAt), language)} />
            <PreviewFact label={t("previewFileLocation")} value={source?.source === "browse" ? t("previewBrowseSource") : t("previewLibrarySource")} />
          </dl>
        </aside>
      ) : null}
    </div>
  );
}

function QuickPreviewFooter({
  mode,
  status,
  canReveal,
  onReveal,
  onClose,
  t
}: {
  mode: "floating" | "pinned";
  status: string;
  canReveal: boolean;
  onReveal: () => void;
  onClose: () => void;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  return (
    <footer className="zc-floating-preview-footer">
      <span className="zc-floating-preview-footer-status">
        {mode === "pinned" ? t("previewPinnedHint") : status}
      </span>
      <div className="zc-floating-preview-footer-actions">
        {canReveal ? (
          <button type="button" className={buttonSecondary} onClick={onReveal}>
            {t("previewShowLocation")}
          </button>
        ) : null}
        <button type="button" className={buttonSecondary} onClick={onClose}>
          {t("libraryPreviewClose")}
        </button>
      </div>
    </footer>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return <div className="zc-floating-preview-fact"><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}
