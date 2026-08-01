import type { ReactNode } from "react";
import type { Translator } from "../../../types/ui";
import { SettingsSection } from "../components/SettingsPrimitives";

export function AISettingsSection({ t, children }: { t: Translator; children: ReactNode }) {
  return (
    <SettingsSection id="settings-ai" title={t("settingsAI")} description={t("settingsAIDesc")}>
      {children}
    </SettingsSection>
  );
}
