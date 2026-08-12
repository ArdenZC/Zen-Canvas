import type { CloseBehavior } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import {
  SettingsControlGroup,
  SettingsRow,
  SettingsSection,
  SettingsSegmentedControl,
  SettingsSwitch
} from "../components/SettingsPrimitives";

export interface GeneralSettingsSectionProps {
  t: Translator;
  closeBehavior: CloseBehavior;
  onCloseBehavior: (value: CloseBehavior) => void;
  backgroundIndexOnStartup: boolean;
  onBackgroundIndexOnStartup: (value: boolean) => void;
  launchAtLogin: boolean;
  onLaunchAtLogin: (value: boolean) => void;
}

export function GeneralSettingsSection({
  t,
  closeBehavior,
  onCloseBehavior,
  backgroundIndexOnStartup,
  onBackgroundIndexOnStartup,
  launchAtLogin,
  onLaunchAtLogin
}: GeneralSettingsSectionProps) {
  return (
    <SettingsSection id="settings-general" title={t("settingsGeneral")} description={t("settingsGeneralDesc")}>
      <SettingsControlGroup title={t("settingsWindowBehavior")} description={t("settingsWindowBehaviorDesc")}>
        <SettingsRow label={t("closeBehavior")} description={t("closeBehaviorDesc")}>
          <SettingsSegmentedControl
            value={closeBehavior}
            ariaLabel={t("closeBehavior")}
            options={[
              { value: "ask", label: t("askEveryTime") },
              { value: "minimize", label: t("minimizeToTray") },
              { value: "quit", label: t("quitApp") }
            ]}
            onChange={onCloseBehavior}
          />
        </SettingsRow>
      </SettingsControlGroup>

      <SettingsControlGroup title={t("settingsStartup")} description={t("settingsStartupDesc")}>
        <SettingsSwitch
          id="settings-background-index-startup"
          label={t("backgroundIndexOnStartup")}
          description={t("backgroundIndexOnStartupDesc")}
          checked={backgroundIndexOnStartup}
          onChange={onBackgroundIndexOnStartup}
        />
        <SettingsSwitch
          id="settings-launch-at-login"
          label={t("launchAtLogin")}
          description={t("launchAtLoginDesc")}
          checked={launchAtLogin}
          onChange={onLaunchAtLogin}
        />
      </SettingsControlGroup>
    </SettingsSection>
  );
}
