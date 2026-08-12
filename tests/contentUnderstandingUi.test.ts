import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import { contentStatusLabel } from "../src/views/vault/components/ContentUnderstandingSheet";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("PR9 Content Understanding surface", () => {
  it("keeps the File Library Inspector concise and delegates the workflow", () => {
    const inspector = read("src/views/vault/components/FileLibraryInspector.tsx");
    const vault = read("src/views/vault/VaultView.tsx");
    const sheet = read("src/views/vault/components/ContentUnderstandingSheet.tsx");

    expect(inspector).toContain('t("contentStatus")');
    expect(inspector).toContain('t("contentOpen")');
    expect(inspector).not.toContain("ContentPreview");
    expect(inspector).not.toContain("ContentRun");
    expect(inspector).not.toContain("tauriApi");
    expect(inspector).not.toContain("ContentScopePolicy");
    expect(inspector).not.toContain("previewContentRun");
    expect(vault).toContain("ContentUnderstandingSheet");
    expect(vault).toContain("openContentFromContext");
    expect(vault).toContain("useMemo(() => selectedLoadedIds(files, selection)");
    expect(sheet).toContain("SideSheet");
    expect(sheet).toContain('expectedLibraryRevision: detail.revision');
    expect(sheet).toContain("expectedPolicyRevisions");
    expect(sheet).toContain("previewFingerprint");
    expect(sheet).toContain("confirmed: true");
    expect(sheet).toContain('"existing_interactive_provider"');
    expect(sheet).not.toContain("detail.path");
  });

  it("maps internal status values to task-language copy", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");
    expect(contentStatusLabel("not_analyzed", zh)).toBe("未分析");
    expect(contentStatusLabel("ready", en)).toBe("Ready");
    expect(contentStatusLabel("needs_attention", zh)).toBe("需要处理");
    expect(contentStatusLabel("unknown_backend_value", en)).toBe("Status unavailable");
  });

  it("keeps local extraction, provider consent, and mock truthfulness distinct", () => {
    const sheet = read("src/views/vault/components/ContentUnderstandingSheet.tsx");
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");
    expect(sheet).toContain('t("contentAllowLocal")');
    expect(sheet).toContain('t("contentAllowCloud")');
    expect(sheet).toContain('t("contentConfirmStart")');
    expect(sheet).toContain('t("contentDeleteData")');
    expect(sheet).toContain('t("contentRecentRuns")');
    expect(sheet).toContain('t("contentBrowserMock")');
    expect(zh("contentProviderDisclosure")).toContain("不发送路径或文件名");
    expect(en("contentSourceUnchanged")).toContain("never modifies");
  });
});
