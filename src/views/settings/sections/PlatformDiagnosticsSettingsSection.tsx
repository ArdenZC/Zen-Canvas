import type { GlobalIndexSource, GlobalIndexStatus, RuntimeCapabilities } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { quietText } from "../../shared/ui";
import { SettingsControlGroup, SettingsRow, SettingsSection } from "../components/SettingsPrimitives";

export interface PlatformDiagnosticsSettingsSectionProps {
  t: Translator;
  capabilities: RuntimeCapabilities | null;
  globalIndexStatus: GlobalIndexStatus | null;
  globalIndexSources: GlobalIndexSource[];
  statusText: (status: string) => string;
}

function platformLabel(value: string | undefined, t: Translator) {
  if (value === "macos") return t("platformMacos");
  if (value === "windows") return t("platformWindows");
  if (value === "linux") return t("platformLinux");
  return t("platformUnknown");
}

function architectureLabel(value: string | undefined, t: Translator) {
  if (value === "aarch64") return t("architectureArm64");
  if (value === "x86_64") return t("architectureX8664");
  return value || t("platformUnknown");
}

function capabilityLabel(enabled: boolean | undefined, t: Translator) {
  return enabled ? t("platformCapabilityAvailable") : t("platformCapabilityUnavailable");
}

function filesystemLabel(sources: GlobalIndexSource[], t: Translator) {
  const filesystem = sources.find((source) => source.volume.filesystemType.trim())?.volume.filesystemType.trim();
  if (!filesystem) return t("platformUnknown");
  return filesystem.toLowerCase() === "apfs" ? "APFS" : filesystem;
}

function coverageLabel(status: string | undefined, t: Translator, statusText: (status: string) => string) {
  switch (status) {
    case "ready":
      return t("platformCoverageReady");
    case "partial":
      return t("platformCoveragePartial");
    case "permission_required":
      return t("platformCoveragePermissionRequired");
    case "spotlight_not_indexed":
      return t("platformCoverageSpotlightNotIndexed");
    default:
      return status ? statusText(status) : t("platformUnknown");
  }
}

export function PlatformDiagnosticsSettingsSection({
  t,
  capabilities,
  globalIndexStatus,
  globalIndexSources,
  statusText
}: PlatformDiagnosticsSettingsSectionProps) {
  const isMac = capabilities?.platform === "macos";
  const coverage = coverageLabel(globalIndexStatus?.status, t, statusText);
  const fsevents = !isMac
    ? t("platformNotApplicable")
    : globalIndexStatus?.status === "fsevents_unavailable"
      ? t("platformCapabilityUnavailable")
      : globalIndexStatus
        ? t("platformCapabilityAvailable")
        : t("platformUnknown");

  return (
    <SettingsSection id="settings-platform-diagnostics" title={t("platformDiagnosticsTitle")} description={t("platformDiagnosticsDesc")}>
      <SettingsControlGroup title={t("platformIdentityTitle")} description={t("platformIdentityDesc")}>
        <SettingsRow label={t("platformDiagnosticsPlatform")}>
          <span className={quietText}>{platformLabel(capabilities?.platform, t)}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsArchitecture")}>
          <span className={quietText}>{architectureLabel(capabilities?.architecture, t)}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsMacosVersion")}>
          <span className={quietText}>{isMac ? capabilities?.macosVersion || t("platformUnknown") : t("platformNotApplicable")}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsFilesystem")}>
          <span className={quietText}>{filesystemLabel(globalIndexSources, t)}</span>
        </SettingsRow>
      </SettingsControlGroup>

      <SettingsControlGroup title={t("platformHealthTitle")} description={t("platformHealthDesc")}>
        <SettingsRow label={t("platformDiagnosticsSpotlight")}>
          <span className={quietText}>{isMac && globalIndexStatus ? statusText(globalIndexStatus.status) : isMac ? t("platformUnknown") : t("platformNotApplicable")}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsFsevents")}>
          <span className={quietText}>{fsevents}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsCoverage")}>
          <span className={quietText}>{coverage}</span>
        </SettingsRow>
      </SettingsControlGroup>

      <SettingsControlGroup title={t("platformSafetyTitle")} description={t("platformSafetyDesc")}>
        <SettingsRow label={t("platformDiagnosticsPackages")}>
          <span className={quietText}>{capabilityLabel(capabilities?.macosPackageAwarenessAvailable, t)}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsCloud")}>
          <span className={quietText}>{capabilityLabel(capabilities?.macosCloudAwarenessAvailable, t)}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsMutation")}>
          <span className={quietText}>{capabilityLabel(capabilities?.fileMutationAvailable, t)}</span>
        </SettingsRow>
        <SettingsRow label={t("platformDiagnosticsSafeTrash")}>
          <span className={quietText}>{capabilityLabel(capabilities?.macosSafeTrashAvailable, t)}</span>
        </SettingsRow>
      </SettingsControlGroup>
    </SettingsSection>
  );
}
