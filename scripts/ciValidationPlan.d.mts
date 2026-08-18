export type ValidationLane =
  | "head_validation"
  | "merge_integration"
  | "push"
  | "scheduled_full_validation"
  | "manual_full_validation";

export interface ValidationPlanInput {
  eventName?: string;
  sourceEvidenceResult?: string;
  changeScopeResult?: string;
  validationLane?: ValidationLane | string;
  headCheckoutSha?: string;
  headTreeSha?: string;
  integrationCheckoutSha?: string;
  integrationTreeSha?: string;
  eventCheckoutSha?: string;
  eventTreeSha?: string;
  prHeadSha?: string;
  eventSha?: string;
}

export interface ValidationPlan {
  schema_version: 1;
  plan_valid: boolean;
  event_name: string;
  tree_equivalent: boolean | null;
  head_validation_required: boolean;
  validation_lanes: ValidationLane[];
  head_checkout_sha: string | null;
  head_tree_sha: string | null;
  integration_checkout_sha: string | null;
  integration_tree_sha: string | null;
  event_checkout_sha: string | null;
  event_tree_sha: string | null;
  reason: string;
}

export interface ValidationAggregateInput {
  eventName?: string;
  planResult?: string;
  planValid?: boolean | string;
  treeEquivalent?: boolean | string | null;
  headValidationRequired?: boolean | string;
  validationLanes?: ValidationLane[] | string;
  validationLane?: ValidationLane | string;
  laneJobResult?: string | null;
  headValidationResult?: string | null;
  integrationValidationResult?: string | null;
}

export interface ValidationAggregateResult {
  pass: boolean;
  reason: string;
  expected_lanes?: ValidationLane[];
}

export function buildValidationPlan(input?: ValidationPlanInput): ValidationPlan;
export function evaluateValidationAggregate(input?: ValidationAggregateInput): ValidationAggregateResult;
