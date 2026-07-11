import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("command modal spotlight polish", () => {
  it("uses shared primitives for empty, failed, scoped empty, and result badges", () => {
    const commandModal = read("src/components/CommandModal.tsx");

    expect(commandModal).toContain("StateBlock");
    expect(commandModal).toContain("ToneBadge");
    expect(commandModal).toContain("formatDisplayPath");
    expect(commandModal).toContain("compactPath(formatDisplayPath(file.path");
    expect(commandModal).toContain("isScopedEmpty");
    expect(commandModal).toContain('queryState === "failed" ? "error"');
    expect(commandModal).not.toContain("CommandEmptyState");
  });

  it("uses purpose-driven result tones and dynamic file icons", () => {
    const commandModal = read("src/components/CommandModal.tsx");

    expect(commandModal).toContain("FileText, Folder, Image as ImageIcon, LayoutGrid, Radar");
    expect(commandModal).toContain("function getIcon(fileType: string)");
    expect(commandModal).toContain('if (type === "folder") return <Folder size={20} strokeWidth={1.5} />');
    expect(commandModal).toContain('if (type === "video" || type === "mp4") return <Video size={20} strokeWidth={1.5} />');
    expect(commandModal).toContain('if (type === "image" || type === "png" || type === "jpg") return <ImageIcon size={20} strokeWidth={1.5} />');
    expect(commandModal).toContain('if (type === "code" || type === "ts" || type === "js" || type === "tsx" || type === "json") return <Code size={20} strokeWidth={1.5} />');
    expect(commandModal).toContain("return <FileText size={20} strokeWidth={1.5} />");
    expect(commandModal).toContain('const purpose = (file.purpose || "").toLowerCase()');
    expect(commandModal).toContain('purpose.includes("strategy") || purpose.includes("finance") || file.lifecycle === "Archive"');
    expect(commandModal).toContain('purpose.includes("media") || purpose.includes("image")');
    expect(commandModal).toContain('purpose.includes("code") || purpose.includes("script")');
    expect(commandModal).toContain('purpose.includes("doc") || purpose.includes("text")');
    expect(commandModal).toContain('file.risk_level === "Sensitive" || purpose.includes("sensitive")');
    expect(commandModal).toContain('{getIcon(file.extension ? file.extension.replace(".", "") : file.file_type)}');
    expect(commandModal).toContain('<ToneBadge tone={tone as any}>{file.purpose}</ToneBadge>');
    expect(commandModal).toContain('<ToneBadge tone={file.risk_level === "Sensitive" ? "red" : "amber"}>');
    expect(commandModal).toContain('<ToneBadge tone="amber">{t("libraryDuplicateFiles")}</ToneBadge>');
    expect(commandModal).not.toContain('<File size={20} strokeWidth={1.5} />');
    expect(commandModal).not.toContain('<ToneBadge tone="info">{file.purpose}</ToneBadge>');
  });

  it("keeps spotlight controls accessible and avoids scale-based motion", () => {
    const commandModal = read("src/components/CommandModal.tsx");

    expect(commandModal).toContain('aria-label={t("commandClearSearch")}');
    expect(commandModal).toContain('title={t("commandClearSearch")}');
    expect(commandModal).toContain("aria-live");
    expect(commandModal).toContain('aria-busy={queryState === "pending"}');
    expect(commandModal).toContain('role={standalone ? "search" : "dialog"}');
    expect(commandModal).toContain("aria-modal={standalone ? undefined : true}");
    expect(commandModal).toContain('aria-label={t("globalSearch")}');
    expect(commandModal).toContain("shortcutHints");
    expect(commandModal).not.toContain("scale-");
  });

  it("uses the standalone floating Spotlight alignment and restrained motion contract", () => {
    const commandModal = read("src/components/CommandModal.tsx");

    expect(commandModal).toContain(
      '"w-full overflow-hidden border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] text-[var(--zc-text-primary)] shadow-[var(--zc-shadow-spotlight)] backdrop-blur-xl"'
    );
    expect(commandModal).not.toContain("transition-[border-radius]");
    expect(commandModal).toContain(
      'relative z-10 flex h-full w-full items-start justify-center bg-transparent pt-8 px-8'
    );
    expect(commandModal).toContain(
      'fixed inset-0 z-40 flex items-start justify-center bg-[var(--zc-overlay)] px-5 pt-[15vh] backdrop-blur-sm sm:pt-[20vh]'
    );
    expect(commandModal).toContain("<motion.div");
    expect(commandModal).toContain("layout");
    expect(commandModal).toContain('window.addEventListener("blur", handleBlur)');
    expect(commandModal).toContain('window.removeEventListener("blur", handleBlur)');
    expect(commandModal).toContain("const handleBlur = () => onClose();");
    expect(commandModal).toContain("}, [standalone, onClose]);");
    expect(commandModal).toContain("initial={{ opacity: 0, y: 8 }}");
    expect(commandModal).toContain("animate={{ opacity: 1, y: 0 }}");
    expect(commandModal).toContain("exit={{ opacity: 0, y: 8 }}");
    expect(commandModal).toContain("transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}");
    expect(commandModal).not.toContain("scale:");
  });

  it("uses polished shortcut badges and active result text treatment", () => {
    const commandModal = read("src/components/CommandModal.tsx");

    expect(commandModal).toContain("CornerDownLeft");
    expect(commandModal).toContain("font-mono");
    expect(commandModal).not.toContain("font-sans font-medium");
    expect(commandModal).toContain('function ShortcutHint({ badge, label }: { badge: React.ReactNode; label: string })');
    expect(commandModal).toContain('<ShortcutHint badge={<CornerDownLeft className="w-3 h-3" />} label={t("commandOpenHint")} />');
    expect(commandModal).toContain('<ShortcutHint badge="↑↓" label="to navigate" />');
    expect(commandModal).toContain('<ShortcutHint badge="ESC" label="to close" />');
    expect(commandModal).toContain('<strong className={commandFileName}>');
    expect(commandModal).toContain('className="text-[var(--zc-primary)]"');
    expect(commandModal).not.toContain('ShortcutHint badge="↵"');
    expect(commandModal).not.toContain("badge={locateKey}");
    expect(commandModal).not.toContain("badge={sortingPreviewKey}");
  });

  it("keeps standalone idle spotlight collapsed to the search pill", () => {
    const commandModal = read("src/components/CommandModal.tsx");

    expect(commandModal).toContain("const isStandaloneCollapsed =");
    expect(commandModal).toContain("standalone");
    expect(commandModal).toContain("!trimmedSearch");
    expect(commandModal).toContain('queryState === "idle"');
    expect(commandModal).toContain("!isScopedEmpty");
    expect(commandModal).toContain("const shouldShowIdleState = !standalone && !trimmedSearch");
    expect(commandModal).toContain("isStandaloneCollapsed ? commandShellCollapsed : commandShellExpanded");
    expect(commandModal).toContain("h-16 w-full max-w-[720px] rounded-full");
    expect(commandModal).toContain("standaloneSearchWindowCollapsedHeight = 160");
    expect(commandModal).toContain("standaloneSearchWindowExpandedHeight = 660");
    expect(commandModal).not.toContain("px-5 pt-2");
    expect(commandModal).not.toContain("pt-[9vh]");
  });

  it("adds product copy for spotlight states and shortcut hints", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");

    expect(zh("commandIdleTitle")).toBe("输入关键词开始检索");
    expect(zh("commandTypingTitle")).toBe("正在准备搜索");
    expect(zh("commandScopedEmptyTitle")).toBe("当前搜索范围为空");
    expect(zh("commandOpenHint")).toBe("打开结果");
    expect(en("commandIdleTitle")).toBe("Type to search");
    expect(en("commandScopedEmptyTitle")).toBe("This search scope is empty");
    expect(en("commandClearSearch")).toBe("Clear Spotlight search");
  });
});
