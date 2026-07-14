import type { Translator } from "../../types/ui";
import type { AutomationRunState } from "../automation/automationModel";
import { mutedText } from "../shared/ui";

export function AutomationRunFeedback({ state, t }: { state: AutomationRunState; t: Translator }) {
  if (state.kind === "idle") return <p className={mutedText}>{t("automationNoPersistedRun")}</p>;
  if (state.kind === "running") return <p className={mutedText} role="status">{t("automationRunInProgress")}</p>;
  if (state.kind === "stale") return <p className="text-xs text-[var(--muted)]" role="status">{t("automationRunStale")}</p>;
  if (state.kind === "failed") return <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{state.message || t("automationRunFailed")}</p>;
  return <p className={mutedText} role="status">{t("automationRunComplete").replace("{updated}", String(state.updated)).replace("{scanned}", String(state.scanned)).replace("{skipped}", String(state.skipped))}{state.warning ? ` · ${state.warning}` : ""}</p>;
}
