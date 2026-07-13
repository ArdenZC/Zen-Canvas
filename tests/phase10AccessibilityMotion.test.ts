import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("phase 10 motion and accessibility contracts", () => {
  it("honors reduced motion and keeps shared motion quiet", () => {
    const styles = read("src/styles.css");
    const sharedUi = read("src/views/shared/ui.ts");
    const allSource = readAllSource();

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("animation-duration: 0.001ms !important");
    expect(styles).toContain("transition-duration: 0.001ms !important");
    expect(sharedUi).toContain("opacity: 0");
    expect(sharedUi).toContain("y: 8");
    expect(sharedUi).toContain('filter: "blur(2px)"');
    expect(sharedUi).not.toContain("staggerChildren");
    expect(sharedUi).not.toContain("delayChildren");
    expect(allSource).not.toContain("scale-");
    expect(allSource).not.toContain("whileTap");
    expect(allSource).not.toContain("whileHover");
  });

  it("keeps shared controls semantically keyboard accessible", () => {
    const sharedUi = read("src/views/shared/ui.ts");
    const commandModal = read("src/components/CommandModal.tsx");
    const settingsView = read("src/views/settings/SettingsView.tsx");
    const rulesView = read("src/views/rules/RulesView.tsx");

    expect(sharedUi).toContain('"aria-label": label');
    expect(sharedUi).toContain('"aria-checked": checked');
    expect(sharedUi).toContain('"aria-pressed": value === option.value');
    expect(commandModal).toContain("ModalPortal");
    expect(commandModal).toContain("onEscape={onClose}");
    expect(commandModal).not.toContain("cycleDialogFocus");
    expect(commandModal).toContain('event.key === "Enter" && activeResult');
    expect(commandModal).toContain('role="combobox"');
    expect(commandModal).toContain('role="listbox"');
    expect(commandModal).toContain('role="option"');
    expect(settingsView).toContain("SwitchButton");
    expect(settingsView).toContain("statusLabel={root.enabled ? t(\"enabled\") : t(\"disabled\")}");
    expect(rulesView).toContain("role=\"switch\"");
    expect(rulesView).toContain("aria-checked={rule.enabled}");
  });

  it("keeps icon-only and dangerous actions labelled", () => {
    const shellChrome = read("src/components/ShellChrome.tsx");
    const appShell = read("src/components/AppShell.tsx");
    const assetCard = read("src/views/vault/AssetCard.tsx");
    const settingsView = read("src/views/settings/SettingsView.tsx");
    const rulesView = read("src/views/rules/RulesView.tsx");
    const commandModal = read("src/components/CommandModal.tsx");

    expect(shellChrome).toContain("aria-label={themeLabel}");
    expect(appShell).toContain('aria-label={t("close")}');
    expect(assetCard).toContain('aria-label={t("revealPhysical")}');
    expect(assetCard).toContain('title={t("revealPhysical")}');
    expect(commandModal).toContain('aria-label={t("commandClearSearch")}');
    expect(commandModal).toContain('title={t("commandClearSearch")}');
    expect(settingsView).toContain('title={t("deleteScanFolder")}');
    expect(settingsView).toContain('aria-label={t("deleteScanFolder")}');
    expect(settingsView).toContain('title={t("deleteSearchFolder")}');
    expect(settingsView).toContain('aria-label={t("deleteSearchFolder")}');
    expect(rulesView).toContain('title={deleteLabel}');
    expect(rulesView).toContain('aria-label={deleteLabel}');
  });

  it("keeps the File Library list and Inspector readable at the minimum desktop width", () => {
    const vaultView = read("src/views/vault/VaultView.tsx");
    const list = read("src/views/vault/components/FileLibraryList.tsx");
    const inspector = read("src/views/vault/components/FileLibraryInspector.tsx");

    expect(vaultView).toContain("max-[1100px]:grid-cols-1");
    expect(list).toContain("min-w-[560px]");
    expect(list).toContain("max-[1100px]:min-w-0");
    expect(list).toContain('role="listbox"');
    expect(inspector).toContain("max-w-xl");
  });
});

function readAllSource() {
  return [
    "src/components/AppShell.tsx",
    "src/components/CommandModal.tsx",
    "src/components/ShellChrome.tsx",
    "src/views/hub/HubView.tsx",
    "src/views/rules/RulesView.tsx",
    "src/views/scanner/ScannerView.tsx",
    "src/views/settings/SettingsView.tsx",
    "src/views/shared/ui.ts",
    "src/views/timeline/TimelineView.tsx",
    "src/views/timeline/PreviewFileRow.tsx",
    "src/views/vault/AssetCard.tsx",
    "src/views/vault/VaultView.tsx"
  ].map(read).join("\n");
}
