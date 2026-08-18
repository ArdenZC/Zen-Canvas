export type CiEvidenceLane =
  | "head_validation"
  | "merge_integration"
  | "push"
  | "scheduled_full_validation"
  | "manual_full_validation";

export interface CiEvidenceInput {
  eventName?: string;
  lane?: CiEvidenceLane;
  repository?: string;
  eventSha?: string;
  eventBefore?: string;
  selectedRef?: string;
  prBaseSha?: string;
  prHeadSha?: string;
  prHeadRepository?: string;
  prHeadRef?: string;
  actualCheckoutSha?: string;
  actualCheckoutTree?: string;
  runId?: string;
  jobId?: string;
  workflowRef?: string;
}

export interface ResolvedCiEvidence {
  lane: CiEvidenceLane;
  event_name: string;
  source_repository: string;
  checkout_repository: string;
  checkout_ref: string;
  selected_ref: string;
  expected_checkout_sha: string;
  expected_pr_base_sha: string | null;
  expected_pr_head_sha: string | null;
  integration_commit_sha: string | null;
  diff_base: string | null;
  diff_head: string;
  head_repository_kind: "same_repository" | "fork" | null;
  source_is_trusted: boolean;
  pr_head_ref: string | null;
}

export interface CheckoutEvidence extends ResolvedCiEvidence {
  schema_version: 1;
  actual_checkout_sha: string;
  actual_checkout_tree: string;
  run_id: string | null;
  job_id: string | null;
  workflow_ref: string | null;
}

export function isValidSha(value: unknown): boolean;
export function resolveCiEvidence(input?: CiEvidenceInput): ResolvedCiEvidence;
export function assertCheckoutEvidence(expectedSha: string, actualSha: string): true;
export function buildCheckoutEvidence(input?: CiEvidenceInput): CheckoutEvidence;
