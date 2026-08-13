import { readableError } from "../../utils/viewHelpers";
import type { OrganizationPlan } from "../../types/domain";

export type GroupLoadingOwner = {
  kind: "open_plan" | "pagination";
  epoch: number;
  planId: string;
  planRevision: number | null;
  cursor: string | null;
  projectionFingerprint: string | null;
};

export interface OrganizationPlanConcurrencyState {
  activePlan: OrganizationPlan | null;
  requestEpoch: number;
  mutationToken: number;
  groupRequestEpoch: number;
  groupProjectionFingerprint: string | null;
  groupNextCursor: string | null;
  groupLoadingOwner: GroupLoadingOwner | null;
  isLoading: boolean;
}

export function ownsPlanMutation(
  getState: () => OrganizationPlanConcurrencyState,
  planId: string,
  planRevision: number,
  requestEpoch: number,
  mutationToken: number
) {
  const state = getState();
  return state.requestEpoch === requestEpoch
    && state.mutationToken === mutationToken
    && state.activePlan?.id === planId
    && state.activePlan.revision === planRevision;
}

export function ownsMutation(
  getState: () => OrganizationPlanConcurrencyState,
  requestEpoch: number,
  mutationToken: number
) {
  const state = getState();
  return state.requestEpoch === requestEpoch && state.mutationToken === mutationToken;
}

export function takeGroupProjectionOwnership<
  T extends { groupLoadingOwner: GroupLoadingOwner | null; isLoading: boolean }
>(state: T, update: Partial<T>): Partial<T> {
  return state.groupLoadingOwner?.kind === "pagination"
    ? { ...update, isLoading: false, groupLoadingOwner: null }
    : update;
}

export interface GroupPageRequest {
  groupRequestEpoch: number;
  requestEpoch: number;
  mutationToken: number;
  planId: string;
  planRevision: number;
  cursor: string;
  projectionFingerprint: string;
  loadingOwner: GroupLoadingOwner;
}

export function ownsGroupPage(
  getState: () => OrganizationPlanConcurrencyState,
  request: GroupPageRequest
) {
  const state = getState();
  return state.groupLoadingOwner === request.loadingOwner
    && state.groupRequestEpoch === request.groupRequestEpoch
    && state.requestEpoch === request.requestEpoch
    && state.mutationToken === request.mutationToken
    && state.activePlan?.id === request.planId
    && state.activePlan.revision === request.planRevision
    && state.groupProjectionFingerprint === request.projectionFingerprint
    && state.groupNextCursor === request.cursor;
}

export function ownsGroupPageLoading(
  getState: () => OrganizationPlanConcurrencyState,
  request: Pick<GroupPageRequest, "loadingOwner">
) {
  const state = getState();
  return state.isLoading && state.groupLoadingOwner === request.loadingOwner;
}

export function matchesGroupPage(
  page: { planId: string; planRevision: number; projectionFingerprint: string },
  planId: string,
  planRevision: number,
  projectionFingerprint?: string
) {
  return page.planId === planId
    && page.planRevision === planRevision
    && typeof page.projectionFingerprint === "string"
    && page.projectionFingerprint.length > 0
    && (projectionFingerprint === undefined || page.projectionFingerprint === projectionFingerprint);
}

export function isOrganizationGroupProjectionChangedError(error: unknown): boolean {
  return readableError(error).includes("organization_group_projection_changed");
}
