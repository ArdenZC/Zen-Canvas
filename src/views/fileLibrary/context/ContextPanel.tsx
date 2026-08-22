import { File, Folder, Info, X } from "lucide-react";
import { SideSheet } from "../../shared/ui";
import { FileLibraryInspector } from "../../vault/components/FileLibraryInspector";
import { formatBytes, formatDate } from "../../../utils/format";
import { cn } from "../../../utils/tw";
import { useI18nContext } from "../../../contexts/AppContexts";
import { useOptionalPreviewExperience } from "../preview/PreviewExperienceProvider";
import { ZenPinnedPreview } from "../preview/ZenPinnedPreview";
import { useContextPanelPresentation } from "./contextPanelPresentation";
import {
  browsePresentationEntryLabel,
  browseSelectedSummaryText,
  type BrowseContextProjection,
  type ContextPanelProjection
} from "./contextPanelProjection";

export function ContextPanel({
  projection,
  open,
  onClose,
  restoreFocus
}: {
  projection: ContextPanelProjection;
  open: boolean;
  onClose: () => void;
  restoreFocus: () => HTMLElement | null;
}) {
  const layout = useContextPanelPresentation();
  const { t } = useI18nContext();
  const preview = useOptionalPreviewExperience();
  const pinned = preview?.state.host === "pinned";
  if (!open || (!pinned && projection.kind === "none")) return null;

  const title = pinned ? t("previewPinnedTitle") : contextTitle(projection);
  const description = pinned ? t("previewPinnedDescription") : contextDescription(projection);
  const closeLabel = pinned ? t("previewUnpin") : contextCloseLabel(projection);
  const closePanel = () => {
    if (pinned) {
      preview?.controller.close("unpin");
      return;
    }
    onClose();
  };

  const content = (
    <div className="file-library-context-panel-content" data-file-library-context-content={pinned ? "preview" : projection.kind}>
      {pinned ? <ZenPinnedPreview /> : projection.source === "library"
        ? <FileLibraryInspector {...projection.inspector} />
        : <BrowseContextContent projection={projection} />}
    </div>
  );

  if (layout === "large") {
    return (
      <aside
        className={cn("file-library-context-panel", "file-library-context-panel-inline")}
        aria-label={title}
        data-file-library-context-panel="true"
        data-file-library-context-source={pinned ? "preview" : projection.source}
        data-file-library-context-layout="inline"
      >
        <header className="file-library-context-inline-header">
          <h2 className="text-sm font-semibold text-[var(--zc-text-primary)]">{title}</h2>
          <button
            type="button"
            className="file-library-context-close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={closePanel}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {content}
      </aside>
    );
  }

  return (
    <SideSheet
      open
      title={title}
      description={description}
      onClose={closePanel}
      closeLabel={closeLabel}
      modalId="file-library-context-panel"
      restoreFocus={restoreFocus}
    >
      <div
        className="file-library-context-panel"
        data-file-library-context-panel="true"
        data-file-library-context-source={pinned ? "preview" : projection.source}
        data-file-library-context-layout="overlay"
      >
        {content}
      </div>
    </SideSheet>
  );
}

function BrowseContextContent({ projection }: { projection: BrowseContextProjection }) {
  const { t } = projection;
  const selected = projection.selectedEntries[0];
  if (projection.kind === "inspector" && selected) {
    const Icon = selected.entryKind === "directory" ? Folder : File;
    return (
      <section className="file-library-context-content-inner" aria-labelledby="file-library-context-entry-title">
        <div className="file-library-context-entry-heading">
          <span className="file-library-context-entry-icon" aria-hidden="true"><Icon size={18} /></span>
          <div className="min-w-0">
            <h2 id="file-library-context-entry-title" className="break-words text-base font-semibold text-[var(--zc-text-primary)]">{selected.displayName}</h2>
            <p className="mt-1 text-xs text-[var(--zc-text-secondary)]">{projection.locationLabel}</p>
          </div>
        </div>
        <dl className="file-library-context-facts">
          <BrowseFact label={t("fileLibraryContextType")} value={browsePresentationEntryLabel(selected)} />
          <BrowseFact label={t("fileLibraryContextKind")} value={selected.entryKind === "directory" ? t("browseFolder") : t("browseFile")} />
          <BrowseFact label={t("fileLibraryContextSize")} value={selected.size === undefined ? t("browseUnknownValue") : formatBytes(selected.size)} />
          <BrowseFact label={t("fileLibraryContextModified")} value={selected.modifiedAt === undefined ? t("browseUnknownValue") : formatDate(String(selected.modifiedAt), projection.language)} />
          {selected.createdAt === undefined ? null : <BrowseFact label={t("fileLibraryContextCreated")} value={formatDate(String(selected.createdAt), projection.language)} />}
          <BrowseFact label={t("fileLibraryContextMaterialization")} value={materializationLabel(selected.materialization, t)} />
        </dl>
        <p className="file-library-context-note"><Info size={15} aria-hidden="true" />{t("fileLibraryContextBrowseSafety")}</p>
      </section>
    );
  }

  return (
    <section className="file-library-context-content-inner" aria-labelledby="file-library-context-selection-title">
      <div className="file-library-context-entry-heading">
        <span className="file-library-context-entry-icon" aria-hidden="true"><Info size={18} /></span>
        <div className="min-w-0">
          <h2 id="file-library-context-selection-title" className="text-base font-semibold text-[var(--zc-text-primary)]">{t("fileLibraryContextSelectionTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--zc-text-secondary)]">{projection.locationLabel}</p>
        </div>
      </div>
      <p className="file-library-context-selection-count">{browseSelectedSummaryText(projection)}</p>
      <dl className="file-library-context-facts">
        <BrowseFact label={t("fileLibraryContextSize")} value={browseSizeLabel(projection)} />
        <BrowseFact label={t("fileLibraryContextTypes")} value={projection.typeCounts.map((item) => `${item.label} ×${item.count}`).join(" · ") || t("browseUnknownValue")} />
      </dl>
      <p className="file-library-context-note"><Info size={15} aria-hidden="true" />{t("fileLibraryContextBrowseMultiSafety")}</p>
    </section>
  );
}

function BrowseFact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function browseSizeLabel(projection: BrowseContextProjection) {
  if (projection.size.total === null) return projection.t("fileLibraryContextUnknownSize");
  const formatted = formatBytes(projection.size.total);
  return projection.size.state === "partial"
    ? `${formatted} · ${projection.t("fileLibraryContextPartialSize")}`
    : formatted;
}

function materializationLabel(value: string | undefined, t: BrowseContextProjection["t"]) {
  if (value === "metadata_only") return t("browseMaterializationMetadata");
  if (value === "remote_placeholder") return t("browseMaterializationRemote");
  if (value === "hydrating") return t("browseMaterializationHydrating");
  if (value === "unavailable") return t("browseMaterializationUnavailable");
  if (value === "unknown") return t("browseMaterializationUnknown");
  return t("fileLibraryContextLocal");
}

function contextTitle(projection: ContextPanelProjection) {
  return projection.source === "library"
    ? projection.inspector.t("fileLibraryContextTitle")
    : projection.t("fileLibraryContextTitle");
}

function contextDescription(projection: ContextPanelProjection) {
  return projection.source === "library"
    ? projection.inspector.t("fileLibraryContextDescription")
    : projection.t("fileLibraryContextDescription");
}

function contextCloseLabel(projection: ContextPanelProjection) {
  return projection.source === "library"
    ? projection.inspector.t("fileLibraryContextClose")
    : projection.t("fileLibraryContextClose");
}
