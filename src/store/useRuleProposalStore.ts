import { create } from "zustand";
import { tauriApi } from "../api/tauriApi";
import type {
  FileLibraryScopeV2,
  Rule,
  RuleDraftV2,
  RuleProposal,
  RuleProposalImpact
} from "../types/domain";
import { readableError } from "../utils/viewHelpers";
import { useRulesStore } from "./useRulesStore";

interface GenerationOwner {
  proposalId: string;
  expectedProposalRevision: number;
}

interface RuleProposalStore {
  proposals: RuleProposal[];
  activeId: string;
  impact: RuleProposalImpact | null;
  generationOwner: GenerationOwner | null;
  busy: boolean;
  error: string;
  load: () => Promise<void>;
  select: (proposalId: string) => Promise<void>;
  generate: (prompt: string, targetRule?: Rule) => Promise<RuleProposal>;
  regenerate: (proposal: RuleProposal, prompt: string, targetRule?: Rule) => Promise<RuleProposal>;
  cancelActiveGeneration: () => Promise<void>;
  cancel: (proposal: RuleProposal) => Promise<void>;
  replaceCandidate: (proposal: RuleProposal, candidate: RuleDraftV2) => Promise<RuleProposal>;
  preview: (proposal: RuleProposal, scope: FileLibraryScopeV2) => Promise<RuleProposalImpact>;
  resolveExact: (proposal: RuleProposal) => Promise<RuleProposalImpact>;
  apply: (proposal: RuleProposal) => Promise<RuleProposal>;
  deleteProposal: (proposal: RuleProposal) => Promise<void>;
  clearError: () => void;
}

let proposalLoadEpoch = 0;
let proposalGenerationEpoch = 0;

function replaceProposal(proposals: RuleProposal[], proposal: RuleProposal) {
  const current = proposals.find((candidate) => candidate.id === proposal.id);
  if (current && current.revision > proposal.revision) return proposals;
  const next = proposals.filter((current) => current.id !== proposal.id);
  return [proposal, ...next].sort((left, right) =>
    right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)
  );
}

function requireRevision(rule: Rule | undefined) {
  if (!rule || !Number.isInteger(rule.revision) || (rule.revision ?? 0) < 1) {
    throw new Error("rule_revision_missing");
  }
  return rule.revision as number;
}

export const useRuleProposalStore = create<RuleProposalStore>((set, get) => ({
  proposals: [],
  activeId: "",
  impact: null,
  generationOwner: null,
  busy: false,
  error: "",

  load: async () => {
    const epoch = ++proposalLoadEpoch;
    set({ busy: true, error: "" });
    try {
      const page = await tauriApi.listRuleProposals(100);
      if (epoch !== proposalLoadEpoch) return;
      set((state) => ({
        proposals: page.proposals,
        activeId: page.proposals.some((proposal) => proposal.id === state.activeId)
          ? state.activeId
          : page.proposals[0]?.id ?? "",
        busy: false
      }));
    } catch (error) {
      if (epoch !== proposalLoadEpoch) return;
      set({ busy: false, error: readableError(error) });
    }
  },

  select: async (proposalId) => {
    set({ activeId: proposalId, impact: null, error: "" });
    try {
      const proposal = await tauriApi.getRuleProposal(proposalId);
      set((state) => ({ proposals: replaceProposal(state.proposals, proposal) }));
    } catch (error) {
      set({ error: readableError(error) });
    }
  },

  generate: async (prompt, targetRule) => {
    const epoch = ++proposalGenerationEpoch;
    const proposalId = `rule-proposal-${crypto.randomUUID()}`;
    const owner = { proposalId, expectedProposalRevision: 2 };
    set({ busy: true, error: "", impact: null, generationOwner: owner, activeId: proposalId });
    try {
      const proposal = await tauriApi.createRuleProposal({
        version: 1,
        requestId: crypto.randomUUID(),
        proposalId,
        prompt,
        intentKind: targetRule ? "update" : "create",
        targetRuleId: targetRule?.id ?? null,
        expectedTargetRuleRevision: targetRule ? requireRevision(targetRule) : null
      });
      if (epoch !== proposalGenerationEpoch) return proposal;
      set((state) => ({
        proposals: replaceProposal(state.proposals, proposal),
        activeId: proposal.id,
        busy: false,
        generationOwner: null
      }));
      return proposal;
    } catch (error) {
      if (epoch !== proposalGenerationEpoch) throw error;
      set({ busy: false, generationOwner: null, error: readableError(error) });
      await get().load();
      throw error;
    }
  },

  regenerate: async (proposal, prompt, targetRule) => {
    const epoch = ++proposalGenerationEpoch;
    const owner = {
      proposalId: proposal.id,
      expectedProposalRevision: proposal.revision + 1
    };
    set({ busy: true, error: "", impact: null, generationOwner: owner });
    try {
      const generated = await tauriApi.regenerateRuleProposal({
        version: 1,
        requestId: crypto.randomUUID(),
        proposalId: proposal.id,
        expectedProposalRevision: proposal.revision,
        prompt,
        intentKind: targetRule ? "update" : proposal.intentKind,
        targetRuleId: targetRule?.id ?? proposal.targetRuleId,
        expectedTargetRuleRevision: targetRule
          ? requireRevision(targetRule)
          : proposal.baseRuleRevision
      });
      if (epoch !== proposalGenerationEpoch) return generated;
      set((state) => ({
        proposals: replaceProposal(state.proposals, generated),
        busy: false,
        generationOwner: null
      }));
      return generated;
    } catch (error) {
      if (epoch !== proposalGenerationEpoch) throw error;
      set({ busy: false, generationOwner: null, error: readableError(error) });
      await get().load();
      throw error;
    }
  },

  cancelActiveGeneration: async () => {
    const owner = get().generationOwner;
    if (!owner) return;
    proposalGenerationEpoch += 1;
    try {
      const cancelled = await tauriApi.cancelRuleProposal(
        owner.proposalId,
        owner.expectedProposalRevision
      );
      set((state) => ({
        proposals: replaceProposal(state.proposals, cancelled),
        activeId: cancelled.id,
        generationOwner: null,
        busy: false,
        impact: null
      }));
    } catch (error) {
      set({ error: readableError(error) });
      throw error;
    }
  },

  cancel: async (proposal) => {
    proposalGenerationEpoch += 1;
    const owner = get().generationOwner;
    const expectedRevision = owner?.proposalId === proposal.id
      ? owner.expectedProposalRevision
      : proposal.revision;
    try {
      const cancelled = await tauriApi.cancelRuleProposal(proposal.id, expectedRevision);
      set((state) => ({
        proposals: replaceProposal(state.proposals, cancelled),
        generationOwner: null,
        busy: false,
        impact: null
      }));
    } catch (error) {
      set({ error: readableError(error) });
      throw error;
    }
  },

  replaceCandidate: async (proposal, candidate) => {
    set({ busy: true, error: "", impact: null });
    try {
      const replaced = await tauriApi.replaceRuleProposalCandidate(
        proposal.id,
        proposal.revision,
        candidate
      );
      set((state) => ({
        proposals: replaceProposal(state.proposals, replaced),
        busy: false
      }));
      return replaced;
    } catch (error) {
      set({ busy: false, error: readableError(error) });
      throw error;
    }
  },

  preview: async (proposal, scope) => {
    set({ busy: true, error: "", impact: null });
    try {
      const impact = await tauriApi.previewRuleProposal(
        proposal.id,
        proposal.revision,
        scope,
        20
      );
      set({ impact, busy: false });
      return impact;
    } catch (error) {
      set({ busy: false, error: readableError(error) });
      throw error;
    }
  },

  resolveExact: async (proposal) => {
    const token = get().impact?.impactToken;
    if (!token) throw new Error("rule_proposal_impact_token_missing");
    set({ busy: true, error: "" });
    try {
      const impact = await tauriApi.resolveRuleProposalExactImpact(
        proposal.id,
        proposal.revision,
        token
      );
      set({ impact, busy: false });
      return impact;
    } catch (error) {
      set({ busy: false, error: readableError(error) });
      throw error;
    }
  },

  apply: async (proposal) => {
    const impact = get().impact;
    if (!impact || impact.impactState !== "exact") {
      throw new Error("rule_proposal_exact_impact_required");
    }
    const targetRule = proposal.targetRuleId
      ? useRulesStore.getState().rules.find((rule) => rule.id === proposal.targetRuleId)
      : undefined;
    set({ busy: true, error: "" });
    try {
      const result = await tauriApi.applyRuleProposal({
        proposalId: proposal.id,
        expectedProposalRevision: proposal.revision,
        expectedCatalogRevision: impact.catalogRevision,
        expectedTargetRuleRevision: targetRule ? requireRevision(targetRule) : null,
        previewFingerprint: impact.previewFingerprint,
        confirmed: true
      });
      useRulesStore.getState().upsertRule(result.rule, result.catalogRevision);
      set((state) => ({
        proposals: replaceProposal(state.proposals, result.proposal),
        activeId: result.proposal.id,
        impact: null,
        busy: false
      }));
      return result.proposal;
    } catch (error) {
      set({ busy: false, error: readableError(error) });
      throw error;
    }
  },

  deleteProposal: async (proposal) => {
    set({ busy: true, error: "" });
    try {
      await tauriApi.deleteRuleProposal(proposal.id, proposal.revision, true);
      set((state) => ({
        proposals: state.proposals.filter((current) => current.id !== proposal.id),
        activeId: state.activeId === proposal.id ? "" : state.activeId,
        impact: null,
        busy: false
      }));
    } catch (error) {
      set({ busy: false, error: readableError(error) });
      throw error;
    }
  },

  clearError: () => set({ error: "" })
}));
