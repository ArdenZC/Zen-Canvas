import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

const read = (file: string) => readFileSync(resolve(file), "utf8");

describe("Organize Suggestions v4.1 interaction contracts", () => {
  it("uses group-row selection semantics with item decisions in the inspector", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");
    expect(view).toContain('role="listbox"');
    expect(view).toContain('role="option"');
    expect(view).toContain("aria-selected={active}");
    expect(view).toContain("data-organize-group-row");
    expect(view).toContain("updateGroupDecision");
    expect(view).toContain("queryOrganizationPlanGroupItems");
    expect(view).not.toContain('type="checkbox"');
  });

  it("keeps virtual focus references limited to a mounted active row", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");
    expect(view).toContain("virtualRows.some");
    expect(view).toContain("aria-activedescendant={mountedActiveId}");
    expect(view).toContain("virtualizer.scrollToIndex");
  });

  it("uses keyset plan pages instead of a legacy OFFSET preview scan", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");
    const store = read("src/store/useOrganizationPlanStore.ts");
    expect(view).toContain("loadNextGroupPage");
    expect(view).toContain("groupNextCursor");
    expect(view).toContain("queryOrganizationPlanGroupItems");
    expect(view).not.toContain("loadNextPage");
    expect(view).not.toContain("refreshPreviewsForFiles");
    expect(view).not.toContain("useOperationQueueStore");
    expect(store).toContain("nextCursor");
    expect(store).toContain("requestEpoch");
    expect(store).not.toContain("OFFSET");
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
