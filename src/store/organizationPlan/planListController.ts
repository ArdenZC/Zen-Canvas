import { tauriApi } from "../../api/tauriApi";
import { readableError } from "../../utils/viewHelpers";
import type { OrganizationPlanState } from "../useOrganizationPlanStore";
import {
  isReviewableOrganizationPlan,
  organizationPlanReviewCount,
  selectReviewableOrganizationPlan
} from "../useOrganizationPlanStore";

type Context = {
  get: () => OrganizationPlanState;
  set: (
    update:
      | Partial<OrganizationPlanState>
      | ((state: OrganizationPlanState) => Partial<OrganizationPlanState>)
  ) => void;
};

export async function loadPlans({ get, set }: Context): Promise<void> {
  const planListRequestEpoch = get().planListRequestEpoch + 1;
  set({ planListRequestEpoch, planListState: "loading", planListError: null, isPlanListLoading: true });
  try {
    const plans = await tauriApi.listOrganizationPlans();
    if (get().planListRequestEpoch !== planListRequestEpoch) return;
    let projectedPlans = plans;
    const selectedPlan = selectReviewableOrganizationPlan(plans, get().activePlan);
    const hydrationCandidates = plans
      .filter((plan) => isReviewableOrganizationPlan(plan.status)
        && plan.effectiveSummary === null
        && organizationPlanReviewCount(plan) > 0)
      .sort((left, right) => {
        if (selectedPlan?.id === left.id) return -1;
        if (selectedPlan?.id === right.id) return 1;
        return 0;
      });
    for (const candidate of hydrationCandidates) {
      if (get().planListRequestEpoch !== planListRequestEpoch) return;
      try {
        const groupPage = await tauriApi.queryOrganizationPlanGroups({ planId: candidate.id, pageSize: 100, cursor: null });
        if (get().planListRequestEpoch !== planListRequestEpoch) return;
        if (groupPage.planId === candidate.id && groupPage.planRevision === candidate.revision) {
          projectedPlans = projectedPlans.map((plan) => plan.id === candidate.id
            ? { ...plan, effectiveSummary: groupPage.effectiveSummary }
            : plan);
          if (groupPage.effectiveSummary.pendingReview > 0) break;
        }
      } catch {
        // Keep the durable list usable and continue with the next candidate.
      }
    }
    if (get().planListRequestEpoch !== planListRequestEpoch) return;
    set({ plans: projectedPlans, planListState: "loaded", planListError: null, isPlanListLoading: false });
  } catch (error) {
    if (get().planListRequestEpoch !== planListRequestEpoch) return;
    set({ planListState: "failed", planListError: readableError(error), isPlanListLoading: false });
  }
}
