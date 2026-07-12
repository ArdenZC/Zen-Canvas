import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

const read = (file: string) => readFileSync(resolve(file), "utf8");

describe("Organize Suggestions v4.1 interaction contracts", () => {
  it("uses separate active-row and batch-checkbox semantics", () => {
    const list = read("src/views/organize/OrganizeSuggestionList.tsx");
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");
    expect(list).toContain('role="listitem"');
    expect(list).toContain('aria-current={active ? "true" : undefined}');
    expect(list).not.toContain("aria-selected={active}");
    expect(list).not.toContain('role="option"');
    expect(view).toContain('organizeSpaceAction(batchMode) === "toggle-batch"');
    expect(view).toContain('else applyDecision(activeSuggestion, "accepted")');
    expect(view).toContain("requestAnimationFrame(() => listRef.current?.focus())");
  });

  it("restores the Inspector to its top only when the active file changes", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");
    expect(view).toContain("if (inspectorRef.current) inspectorRef.current.scrollTop = 0");
    expect(view).toContain("[activeSuggestion?.file.id]");
  });

  it("uses bounded targeted preview loading instead of an unbounded loop", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");
    const store = read("src/store/useOperationQueueStore.ts");
    expect(view).toContain("refreshPreviewsForFiles");
    expect(view).not.toContain("while (useOperationQueueStore.getState().previewHasMore)");
    expect(store).toContain("pages < 8");
    expect(store).toContain("additions === 0");
    expect(store).toContain("previewRequestId !== requestId");
    expect(view).toContain("workspaceRequestRef.current");
    expect(view).toContain("requestId !== workspaceRequestRef.current");
  });

  it("localizes badge, risk summary, and result states in both languages", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");
    for (const key of ["organizePendingBadge", "organizeExecuteRiskSummary", "organizeResultFailedTitle", "organizePreviewInvalidated"] as const) {
      expect(zh(key)).not.toBe(key);
      expect(en(key)).not.toBe(key);
    }
    expect(zh("organizePendingBadge")).not.toContain("pending");
  });

  it("keeps native browser confirmations out of the organize execution path", () => {
    for (const file of ["src/store/useOperationQueueStore.ts", "src/views/organize/OrganizeSuggestionsView.tsx", "src/views/timeline/TimelineView.tsx"]) {
      const source = read(file);
      expect(source).not.toContain("window.confirm");
      expect(source).not.toContain("globalThis.confirm");
    }
  });
});
