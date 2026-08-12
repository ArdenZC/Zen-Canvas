import type { RestoreRetentionDays } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { quietText } from "../../shared/ui";
import { SettingsRow, SettingsSection, SettingsSegmentedControl } from "../components/SettingsPrimitives";

export interface PrivacyContentSettingsSectionProps {
  t: Translator;
  restoreRetentionDays: RestoreRetentionDays;
  onRestoreRetentionDays: (value: RestoreRetentionDays) => void;
}

export function PrivacyContentSettingsSection({ t, restoreRetentionDays, onRestoreRetentionDays }: PrivacyContentSettingsSectionProps) {
  return (
    <SettingsSection id="settings-privacy" title={t("settingsPrivacy")} description={t("settingsPrivacyDesc")}>
      <p className={quietText}>{t("privacyLine")}</p>
      <SettingsRow label={t("logRetention")} description={t("logRetentionDesc")}>
        <SettingsSegmentedControl
          value={String(restoreRetentionDays)}
          ariaLabel={t("logRetention")}
          options={([15, 30, 60, 90] as RestoreRetentionDays[]).map((days) => ({ value: String(days), label: `${days} ${t("days")}` }))}
          onChange={(next) => onRestoreRetentionDays(Number(next) as RestoreRetentionDays)}
        />
      </SettingsRow>
      <p className={quietText}>{t("settingsSafetyRestoreDesc")}</p>
    </SettingsSection>
  );
}
