import { Pin, X } from "lucide-react";
import { useCallback, useId, useRef, type KeyboardEvent } from "react";
import { ModalPortal } from "../../../components/modal/ModalPortal";
import { useI18nContext } from "../../../contexts/AppContexts";
import { buttonSecondary, cn, floatingSurface } from "../../../utils/tw";
import { usePreviewExperience } from "./PreviewExperienceProvider";
import { metadataFromSnapshot, previewStateAnnouncement, renderPreviewBody } from "./PreviewContent";
import { PreviewNavigation } from "./PreviewNavigation";
import { isPreviewSpaceEligible } from "./previewExperienceController";
import type { PreviewAssetRequest } from "../../../types/fileWorkspace";
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

  if (!state.visible || state.host !== "floating") return null;

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
                <span>{t("previewPin")}</span>
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
            {previewStateAnnouncement(state.phase, t)}
          </div>
          <div className="zc-floating-preview-body" data-preview-content="true">
            {renderPreviewBody(state.phase, source, metadata, language, t, state.snapshot, requestPreviewAsset)}
          </div>
          <footer className="zc-floating-preview-footer">
            <PreviewNavigation />
            <div className="zc-floating-preview-footer-actions">
              <span className="zc-floating-preview-hint">{t("previewSpaceToClose")}</span>
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

function handleHostKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  close: () => boolean
) {
  if (event.key !== " " && event.key !== "Space") return;
  if (!isPreviewSpaceEligible({
    altKey: event.altKey,
    defaultPrevented: event.defaultPrevented,
    isComposing: event.nativeEvent.isComposing,
    repeat: event.repeat,
    target: event.target
  })) return;
  event.preventDefault();
  close();
}
