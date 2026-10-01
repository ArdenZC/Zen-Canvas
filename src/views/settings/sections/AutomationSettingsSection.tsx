import type { Translator } from "../../../types/ui";
import { buttonSecondary } from "../../../utils/tw";
import { quietText } from "../../shared/ui";
import { SettingsRow, SettingsSection } from "../components/SettingsPrimitives";

export interface AutomationSettingsSectionProps {
  t: Translator;
  onOpenRules: () => void;
}

export function AutomationSettingsSection({ t, onOpenRules }: AutomationSettingsSectionProps) {
  return (
    <SettingsSection id="settings-automation" title={t("settingsAutomation")} description={t("settingsAutomationDesc")}>
      <p className={quietText}>{t("automationFixedPolicy")}</p>
      <SettingsRow label={t("automationIntents")} description={t("automationIntentDescription")}>
        <button className={buttonSecondary} onClick={onOpenRules}>
          {t("automationIntentWorkspaceTitle")}
        </button>
      </SettingsRow>
    </SettingsSection>
  );
}
