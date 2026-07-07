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
    expect(commandModal).toContain("compactPath(file.path");
    expect(commandModal).toContain("isScopedEmpty");
    expect(commandModal).toContain('queryState === "failed" ? "error"');
    expect(commandModal).not.toContain("CommandEmptyState");
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
    expect(commandModal).toContain("commandShortcutHints");
    expect(commandModal).not.toContain("scale-");
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
    expect(commandModal).toContain("h-full max-w-none rounded-full");
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
