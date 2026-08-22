import { Pin, X } from "lucide-react";
import { useId } from "react";
import { useI18nContext } from "../../../contexts/AppContexts";
import { cn } from "../../../utils/tw";
import { usePreviewExperience } from "./PreviewExperienceProvider";
import { metadataFromSnapshot, renderPreviewBody } from "./PreviewContent";
import { PreviewNavigation } from "./PreviewNavigation";

export function ZenPinnedPreview() {
  const { controller, state } = usePreviewExperience();
  const { language, t } = useI18nContext();
  const titleId = useId();
  const source = state.source;
  const metadata = metadataFromSnapshot(state.snapshot);

  if (!state.visible || state.host !== "pinned") return null;

  const title = source?.displayName ?? t("previewPinnedTitle");
  const description = source?.source === "browse" ? t("previewBrowseSource") : t("previewLibrarySource");
  return (
    <section
      className="zc-pinned-preview"
      role="region"
      aria-labelledby={titleId}
      data-preview-shell="true"
      data-preview-host="zen-pinned"
      data-preview-context-host="true"
      data-preview-state={state.phase}
      data-preview-epoch={state.frontendEpoch}
      data-preview-source={source?.source ?? "none"}
      data-preview-identity={source?.previewSource.kind === "managed"
        ? source.previewSource.fileId
        : source?.previewSource.kind === "ephemeral"
          ? `${source.previewSource.browseSessionId}:${source.previewSource.entryId}`
          : "none"}
    >
      <header className="zc-floating-preview-header">
        <div className="min-w-0">
          <p className="zc-floating-preview-kicker">{t("previewPinnedTitle")}</p>
          <h2 id={titleId} className="zc-floating-preview-title" title={title}>{title}</h2>
          <p className="zc-floating-preview-description">{source === null ? t("previewSelectItem") : description}</p>
        </div>
        <button
          type="button"
          className={cn("zc-floating-preview-close", "zc-pinned-preview-close")}
          aria-label={t("previewUnpin")}
          title={t("previewUnpin")}
          data-preview-unpin="true"
          onClick={() => controller.close("unpin")}
        >
          <Pin size={16} aria-hidden="true" />
          <X size={15} aria-hidden="true" />
        </button>
      </header>
      <div className="zc-floating-preview-body zc-pinned-preview-body" data-preview-content="true">
        {renderPreviewBody(state.phase, source, metadata, language, t)}
      </div>
      <footer className="zc-floating-preview-footer zc-pinned-preview-footer">
        <PreviewNavigation />
        <span className="zc-floating-preview-hint" aria-live="polite">{t("previewPinnedHint")}</span>
      </footer>
    </section>
  );
}
