import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18nContext } from "../../../contexts/AppContexts";
import { buttonSubtle, cn } from "../../../utils/tw";
import { usePreviewExperience } from "./PreviewExperienceProvider";

export function PreviewNavigation({ compact = false }: { compact?: boolean }) {
  const { controller, state } = usePreviewExperience();
  const { t } = useI18nContext();
  if (state.navigation === null) return null;
  return (
    <div className={cn("zc-floating-preview-navigation", compact && "zc-floating-preview-navigation-compact")} aria-label={t("previewSiblingNavigationLabel")}>
      <button
        type="button"
        className={buttonSubtle}
        aria-label={t("previewPrevious")}
        title={t("previewPrevious")}
        disabled={!state.navigation.previousAvailable || state.navigationBusy}
        data-preview-navigation="previous"
        onClick={() => void controller.moveSibling("previous")}
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {compact ? null : <span>{t("previewPrevious")}</span>}
      </button>
      <button
        type="button"
        className={buttonSubtle}
        aria-label={t("previewNext")}
        title={t("previewNext")}
        disabled={!state.navigation.nextAvailable || state.navigationBusy}
        data-preview-navigation="next"
        onClick={() => void controller.moveSibling("next")}
      >
        {compact ? null : <span>{t("previewNext")}</span>}
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
