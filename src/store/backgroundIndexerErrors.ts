import { makeTranslator } from "../i18n";
import { localizedStableError } from "../utils/viewHelpers";
import { useAppStore } from "./useAppStore";

export function reportBackgroundIndexerCancelFailure(error: unknown) {
  const app = useAppStore.getState();
  app.showError(localizedStableError(error, makeTranslator(app.language)));
}
