import { invokeCommand } from "./core";
import type {
  ApplyRuleProposalResult,
  FileLibraryScopeV2,
  Rule,
  RuleCatalogState,
  RuleDraftV2,
  RuleExecutionMode,
  RuleExecutionResultV2,
  RuleProposal,
  RuleProposalImpact,
  RuleProposalPage,
  RuleMutationResultV2,
  RuleExecutionSummary
} from "../types/domain";

export const rulesApi = {
  executeAuthoritativeRulesForPaths(paths: string[]): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("execute_authoritative_rules_for_paths", { paths });
  },
  executeRulesForScopeV2(scope: FileLibraryScopeV2, expectedCatalogRevision: number, mode: RuleExecutionMode = "inbox_only", confirmed = true): Promise<RuleExecutionResultV2> {
    return invokeCommand<RuleExecutionResultV2>("execute_rules_for_scope_v2", { request: { scope, mode, expectedCatalogRevision, confirmed } });
  },
  getRuleCatalogState(): Promise<RuleCatalogState> {
    return invokeCommand<RuleCatalogState>("get_rule_catalog_state");
  },
  listUserRulesV2(): Promise<Rule[]> {
    return invokeCommand<Rule[]>("list_user_rules_v2");
  },
  createUserRuleV2(draft: RuleDraftV2, expectedCatalogRevision: number): Promise<RuleMutationResultV2> {
    return invokeCommand<RuleMutationResultV2>("create_user_rule_v2", { request: { version: 2, requestId: crypto.randomUUID(), expectedCatalogRevision, draft } });
  },
  updateUserRuleV2(ruleId: string, expectedRuleRevision: number, expectedCatalogRevision: number, draft: RuleDraftV2): Promise<RuleMutationResultV2> {
    return invokeCommand<RuleMutationResultV2>("update_user_rule_v2", { request: { ruleId, expectedRuleRevision, expectedCatalogRevision, draft } });
  },
  setUserRuleEnabledV2(ruleId: string, expectedRuleRevision: number, expectedCatalogRevision: number, enabled: boolean): Promise<RuleMutationResultV2> {
    return invokeCommand<RuleMutationResultV2>("set_user_rule_enabled_v2", { request: { ruleId, expectedRuleRevision, expectedCatalogRevision, enabled } });
  },
  deleteUserRuleV2(ruleId: string, expectedRuleRevision: number, expectedCatalogRevision: number, confirmed = true): Promise<RuleCatalogState> {
    return invokeCommand<RuleCatalogState>("delete_user_rule_v2", { request: { ruleId, expectedRuleRevision, expectedCatalogRevision, confirmed } });
  },
  createRuleProposal(request: { version: 1; requestId: string; prompt: string; intentKind: "create" | "update"; proposalId?: string | null; targetRuleId?: string | null; expectedProposalRevision?: number | null; expectedTargetRuleRevision?: number | null }): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("create_rule_proposal", { request });
  },
  regenerateRuleProposal(request: { version: 1; requestId: string; prompt: string; intentKind: "create" | "update"; proposalId: string; expectedProposalRevision: number; targetRuleId?: string | null; expectedTargetRuleRevision?: number | null }): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("regenerate_rule_proposal", { request });
  },
  getRuleProposal(proposalId: string): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("get_rule_proposal", { proposalId });
  },
  listRuleProposals(pageSize = 50, cursor?: string | null): Promise<RuleProposalPage> {
    return invokeCommand<RuleProposalPage>("list_rule_proposals", { request: { pageSize, cursor: cursor ?? null } });
  },
  cancelRuleProposal(proposalId: string, expectedProposalRevision: number): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("cancel_rule_proposal", { request: { proposalId, expectedProposalRevision } });
  },
  deleteRuleProposal(proposalId: string, expectedProposalRevision: number, confirmed = true): Promise<boolean> {
    return invokeCommand<boolean>("delete_rule_proposal", { request: { proposalId, expectedProposalRevision, confirmed } });
  },
  replaceRuleProposalCandidate(proposalId: string, expectedProposalRevision: number, candidate: RuleDraftV2): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("replace_rule_proposal_candidate", { request: { proposalId, expectedProposalRevision, candidate } });
  },
  previewRuleProposal(proposalId: string, expectedProposalRevision: number, scope: FileLibraryScopeV2, pageSize = 20): Promise<RuleProposalImpact> {
    return invokeCommand<RuleProposalImpact>("preview_rule_proposal", { request: { proposalId, expectedProposalRevision, scope, pageSize } });
  },
  resolveRuleProposalExactImpact(proposalId: string, expectedProposalRevision: number, impactToken: string): Promise<RuleProposalImpact> {
    return invokeCommand<RuleProposalImpact>("resolve_rule_proposal_exact_impact", { request: { proposalId, expectedProposalRevision, impactToken } });
  },
  applyRuleProposal(request: { proposalId: string; expectedProposalRevision: number; expectedCatalogRevision: number; expectedTargetRuleRevision?: number | null; previewFingerprint: string; confirmed: boolean }): Promise<ApplyRuleProposalResult> {
    return invokeCommand<ApplyRuleProposalResult>("apply_rule_proposal", { request });
  }
};

export type RulesApi = typeof rulesApi;
