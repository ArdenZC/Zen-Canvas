import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleProposal, RuleProposalPage } from "../src/types/domain";

const apiMocks = vi.hoisted(() => ({
  listRuleProposals: vi.fn(),
  getRuleProposal: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    listRuleProposals: apiMocks.listRuleProposals,
    getRuleProposal: apiMocks.getRuleProposal
  }
}));

import { useRuleProposalStore } from "../src/store/useRuleProposalStore";

describe("Rule Proposal store durability and ordering", () => {
  beforeEach(() => {
    apiMocks.listRuleProposals.mockReset();
    apiMocks.getRuleProposal.mockReset();
    useRuleProposalStore.setState({
      proposals: [],
      activeId: "",
      impact: null,
      generationOwner: null,
      busy: false,
      error: ""
    });
  });

  it("rehydrates an unfinished proposal after the UI state is remounted", async () => {
    const ready = proposal("proposal-ready", 3, "ready");
    apiMocks.listRuleProposals.mockResolvedValue(page(ready));

    await useRuleProposalStore.getState().load();
    expect(useRuleProposalStore.getState().activeId).toBe(ready.id);

    useRuleProposalStore.setState({ proposals: [], activeId: "", impact: null });
    await useRuleProposalStore.getState().load();

    expect(useRuleProposalStore.getState().proposals).toEqual([ready]);
    expect(useRuleProposalStore.getState().activeId).toBe(ready.id);
    expect(apiMocks.listRuleProposals).toHaveBeenCalledWith(100);
  });

  it("keeps the newest list response when an older request arrives late", async () => {
    const older = deferred<RuleProposalPage>();
    const newest = proposal("proposal-newest", 4, "ready");
    apiMocks.listRuleProposals
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(page(newest));

    const firstLoad = useRuleProposalStore.getState().load();
    const secondLoad = useRuleProposalStore.getState().load();
    await secondLoad;
    older.resolve(page(proposal("proposal-old", 3, "draft")));
    await firstLoad;

    expect(useRuleProposalStore.getState().proposals).toEqual([newest]);
    expect(useRuleProposalStore.getState().activeId).toBe(newest.id);
  });

  it("does not replace a newer durable revision with a stale detail response", async () => {
    const newest = proposal("proposal-shared", 6, "ready");
    useRuleProposalStore.setState({ proposals: [newest], activeId: newest.id });
    apiMocks.getRuleProposal.mockResolvedValue(proposal(newest.id, 5, "generating"));

    await useRuleProposalStore.getState().select(newest.id);

    expect(useRuleProposalStore.getState().proposals).toEqual([newest]);
  });
});

function proposal(
  id: string,
  revision: number,
  status: RuleProposal["status"]
): RuleProposal {
  return {
    id,
    status,
    intentKind: "create",
    targetRuleId: null,
    baseRuleRevision: null,
    prompt: "PDF files",
    promptFingerprint: "prompt-fingerprint",
    providerKind: null,
    providerPreset: null,
    model: null,
    astVersion: 1,
    candidate: null,
    candidateFingerprint: null,
    summary: null,
    clarifications: [],
    validation: {
      valid: status === "ready",
      permissionClass: status === "ready" ? "allow" : "deny",
      requiresConfirmation: false,
      broadMatch: false,
      codes: [],
      warnings: []
    },
    appliedRuleId: null,
    revision,
    lastErrorCode: null,
    lastErrorDetail: null,
    createdAt: 1,
    updatedAt: revision,
    generatedAt: null,
    appliedAt: null
  };
}

function page(...proposals: RuleProposal[]): RuleProposalPage {
  return { proposals, nextCursor: null, hasMore: false };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}
