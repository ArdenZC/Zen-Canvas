import type { Language } from "../../../i18n";
import type { FolderNamingLanguage } from "../../../types/domain";
import type { ThemeMode, Translator } from "../../../types/ui";
import { SettingsRow, SettingsSection, SettingsSegmentedControl } from "../components/SettingsPrimitives";

export interface AppearanceSettingsSectionProps {
  t: Translator;
  language: Language;
  onLanguage: (value: Language) => void;
  theme: ThemeMode;
  onTheme: (value: ThemeMode) => void;
  folderNamingLanguage: FolderNamingLanguage;
  onFolderNamingLanguage: (value: FolderNamingLanguage) => void;
}

export function AppearanceSettingsSection({
  t,
  language,
  onLanguage,
  theme,
  onTheme,
  folderNamingLanguage,
  onFolderNamingLanguage
}: AppearanceSettingsSectionProps) {
  return (
    <SettingsSection id="settings-appearance" title={t("settingsAppearance")} description={t("settingsAppearanceDesc")}>
      <SettingsRow label={t("language")} description={t("languageDesc")}>
        <SettingsSegmentedControl
          value={language}
          ariaLabel={t("language")}
          options={[
            { value: "zh", label: t("languageChinese") },
            { value: "en", label: t("languageEnglish") }
          ]}
          onChange={onLanguage}
        />
      </SettingsRow>
      <SettingsRow label={t("appearance")} description={t("appearanceDesc")}>
        <SettingsSegmentedControl
          value={theme}
          ariaLabel={t("appearance")}
          options={[
            { value: "light", label: t("lightTheme") },
            { value: "dark", label: t("darkTheme") },
            { value: "system", label: t("systemTheme") }
          ]}
          onChange={onTheme}
        />
      </SettingsRow>
      <SettingsRow label={t("folderNaming")} description={t("folderNamingDesc")}>
        <SettingsSegmentedControl
          value={folderNamingLanguage}
          ariaLabel={t("folderNaming")}
          options={[
            { value: "en", label: t("englishFolderNames") },
            { value: "zh", label: t("chineseFolderNames") }
          ]}
          onChange={onFolderNamingLanguage}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
