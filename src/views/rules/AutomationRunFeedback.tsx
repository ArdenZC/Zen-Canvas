import type { Translator } from "../../types/ui";
import type { AutomationRunState } from "../automation/automationModel";
import { buttonSecondary } from "../../utils/tw";
import { mutedText } from "../shared/ui";

export function AutomationRunFeedback({ state, t, onRegenerate }: { state: AutomationRunState; t: Translator; onRegenerate: () => void }) {
  if (state.kind === "idle") return <p className={mutedText}>{t("automationNoPersistedRun")}</p>;
  if (state.kind === "running") return <p className={mutedText} role="status">{t("automationRunInProgress")}</p>;
  if (state.kind === "stale") return <div className="grid gap-2"><p className="text-xs text-[var(--muted)]" role="status">{t("automationRunStale")}</p><button type="button" className={buttonSecondary} onClick={onRegenerate}>{t("automationRegenerateSuggestions")}</button></div>;
  if (state.kind === "failed") return <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{state.message || t("automationRunFailed")}</p>;
  return <p className={mutedText} role="status">{t("automationRunComplete").replace("{updated}", String(state.updated)).replace("{scanned}", String(state.scanned)).replace("{skipped}", String(state.skipped))}{state.warning ? ` · ${state.warning}` : ""}</p>;
}
