import { Pin, X } from "lucide-react";
import { useCallback, useId, useRef, type KeyboardEvent } from "react";
import { tauriApi } from "../../../api/tauriApi";
import { ModalPortal } from "../../../components/modal/ModalPortal";
import { useI18nContext } from "../../../contexts/AppContexts";
import { buttonSecondary, cn, floatingSurface } from "../../../utils/tw";
import { usePreviewExperience } from "./PreviewExperienceProvider";
import {
  metadataFromSnapshot,
  previewStateAnnouncement,
  renderPreviewBody,
  usePreviewImagePresentation
} from "./PreviewContent";
import { PreviewNavigation } from "./PreviewNavigation";
import { handleFloatingPreviewSpace, previewPresentationState } from "./previewExperienceController";
import type { PreviewAssetRequest, PreviewNativePresentation } from "../../../types/fileWorkspace";
import { formatBytes, formatDate } from "../../../utils/format";
import "./zenFloatingQuickPreview.css";

export function ZenFloatingQuickPreview() {
  const { controller, state } = usePreviewExperience();
  const { language, t } = useI18nContext();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const requestPreviewAsset = useCallback(
    (request: PreviewAssetRequest) => controller.requestPreviewAsset(request),
    [controller]
  );
  const updateNativePreviewGeometry = useCallback(
    (previewId: string, presentation: PreviewNativePresentation) => controller.updateNativePreviewGeometry(previewId, presentation),
    [controller]
  );
  const imagePresentation = usePreviewImagePresentation(state.snapshot, state.source);

  if (!state.visible || state.host !== "floating") return null;

  const source = state.source;
  const metadata = metadataFromSnapshot(state.snapshot);
  const title = source?.displayName ?? t("previewHostTitle");
  const description = source?.source === "browse" ? t("previewBrowseSource") : t("previewLibrarySource");
  const fileType = metadata?.mediaType ?? source?.typeHint ?? source?.extension ?? source?.entryKind ?? "-";
  const fileSize = metadata?.sizeBytes ?? source?.size;
  const modifiedAt = metadata?.modifiedAtEpochMs ?? source?.modifiedAt;
  const canReveal = source?.previewSource.kind === "managed" && Boolean(state.snapshot?.effectiveCapabilities.canReveal);
  const navigationLabel = state.navigation === null
    ? fileType
    : `${fileType} · ${state.navigation.currentIndex + 1} / ${state.navigation.loadedCount}`;

  async function revealCurrentFile() {
    if (!canReveal || source?.previewSource.kind !== "managed") return;
    await tauriApi.revealFileLibraryEntry(source.previewSource.fileId).catch(() => undefined);
  }

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
        data-preview-content-state={previewPresentationState(state.phase, state.snapshot, imagePresentation.state)}
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
            <div className="zc-floating-preview-header-navigation">
              <PreviewNavigation compact />
            </div>
            <div className="zc-floating-preview-header-title min-w-0">
              <h2 id={titleId} className="zc-floating-preview-title" title={title}>{title}</h2>
              <p className="zc-floating-preview-title-meta">{navigationLabel}</p>
              <p id={descriptionId} className="sr-only">{description}</p>
            </div>
            <div className="zc-floating-preview-header-actions">
              <button
                type="button"
                className="zc-floating-preview-action"
                aria-label={t("previewPin")}
                title={t("previewPin")}
                data-preview-pin="true"
                disabled={state.previewId === null}
                onClick={() => controller.pin()}
              >
                <Pin size={16} aria-hidden="true" />
                <span className="sr-only">{t("previewPin")}</span>
              </button>
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
            </div>
          </header>
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-preview-state-announcement="true"
          >
            {previewStateAnnouncement(state.phase, t, state.snapshot, imagePresentation.state)}
          </div>
          <div className="zc-floating-preview-body" data-preview-content="true">
            <div className="zc-floating-preview-content">
              {renderPreviewBody(state.phase, source, metadata, language, t, state.snapshot, requestPreviewAsset, updateNativePreviewGeometry, imagePresentation.publish)}
            </div>
            <aside className="zc-floating-preview-inspector" aria-label={t("previewFileInfo")}>
              <h3>{t("previewFileInfo")}</h3>
              <dl>
                <PreviewFact label={t("previewFileType")} value={fileType} />
                <PreviewFact label={t("previewFileSize")} value={fileSize === undefined ? "-" : formatBytes(fileSize)} />
                <PreviewFact label={t("previewFileModified")} value={modifiedAt === undefined ? "-" : formatDate(String(modifiedAt), language)} />
                <PreviewFact label={t("previewFileLocation")} value={source?.source === "browse" ? t("previewBrowseSource") : t("previewLibrarySource")} />
              </dl>
            </aside>
          </div>
          <footer className="zc-floating-preview-footer">
            <span className="zc-floating-preview-footer-status">{previewStateAnnouncement(state.phase, t, state.snapshot, imagePresentation.state)}</span>
            <div className="zc-floating-preview-footer-actions">
              {canReveal ? (
                <button type="button" className={buttonSecondary} onClick={() => void revealCurrentFile()}>
                  {t("previewShowLocation")}
                </button>
              ) : null}
              <button type="button" className={buttonSecondary} onClick={() => controller.close("button")}>
                {t("libraryPreviewClose")}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return <div className="zc-floating-preview-fact"><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function handleHostKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  close: () => boolean
) {
  handleFloatingPreviewSpace({
    key: event.key,
    altKey: event.altKey,
    defaultPrevented: event.defaultPrevented,
    isComposing: event.nativeEvent.isComposing,
    repeat: event.repeat,
    target: event.target,
    preventDefault: () => event.preventDefault()
  }, close);
}
