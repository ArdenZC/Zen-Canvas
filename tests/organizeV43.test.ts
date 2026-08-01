import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import { validateOrganizeFileNameForOriginal } from "../src/views/organize/organizeModel";

const read = (file: string) => readFileSync(resolve(file), "utf8");

describe("Organize Files V4.3 group-first review contracts", () => {
  it("starts on the backend group projection and keeps tab semantics backend-derived", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");

    expect(view).toContain('useState<ReviewTab>("plan")');
    expect(view).toContain("state.groups");
    expect(view).toContain('group.readiness === "ready"');
    expect(view).toContain('group.readiness === "requires-decision"');
    expect(view).toContain('group.readiness === "blocked"');
    expect(view).toContain("groupHasMore");
    expect(view).not.toContain("items.reduce");
    expect(view).not.toContain("groupBy");
  });

  it("keeps group decisions, item exceptions, extension protection, and dry run on the existing authorities", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");

    expect(view).toContain("updateGroupDecision");
    expect(view).toContain('handleGroupDecision(group, "accepted")');
    expect(view).toContain('handleGroupDecision(group, "kept")');
    expect(view).toContain("updateDecision");
    expect(view).toContain('handleItemDecision(activeItem, "edited", editedName.trim())');
    expect(view).toContain("validateOrganizeFileNameForOriginal");
    expect(view).toContain("authoritativePreviewId");
    expect(view).toContain("createDryRun");
    expect(view).toContain("ConfirmDialog");
    expect(view).toContain("executeDryRun");
    expect(view).toContain('data-organize-review-action');
    expect(view).not.toContain("useOrganizeDecisionStore");
    expect(view).not.toContain("useOperationQueueStore");
  });

  it("supports continuing an existing plan and exposes recovery navigation without a second ledger", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");

    expect(view).toContain('id="organization-plan-selector"');
    expect(view).toContain("openPlan(event.target.value)");
    expect(view).toContain('setView("restore")');
    expect(view).toContain("SideSheet");
    expect(view).not.toContain("useOperationQueueStore");
    expect(view).not.toContain("useOrganizeDecisionStore");
  });

  it("keeps the filename safety boundary and V4.3 copy available in both languages", () => {
    expect(validateOrganizeFileNameForOriginal("report.txt", "report.pdf")).toBe("extension");
    expect(validateOrganizeFileNameForOriginal("report.txt", "report-final.txt")).toBeNull();

    const zh = makeTranslator("zh");
    const en = makeTranslator("en");
    for (const key of [
      "organizePlanTab",
      "organizeNeedsDecisionTab",
      "organizeCannotProcessTab",
      "organizeGroupInclude",
      "organizeGroupKeep",
      "organizeGroupItemEdit",
      "organizeReviewExecution",
      "organizeDryRunAction",
      "organizeNoPlanTitle"
    ] as const) {
      expect(zh(key)).not.toBe(key);
      expect(en(key)).not.toBe(key);
    }
  });
});
