export interface ReleaseWorkflowRun {
  id?: number | string | null;
  name?: string | null;
  head_sha?: string | null;
  status?: string | null;
  conclusion?: string | null;
  event?: string | null;
  html_url?: string | null;
}

export interface ReleaseWorkflowRunsPayload {
  workflow_runs?: ReleaseWorkflowRun[] | null;
}

export interface ReleaseWorkflowJob {
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
}

export interface ReleaseWorkflowJobsPayload {
  jobs?: ReleaseWorkflowJob[] | null;
}

export const RELEASE_QUALIFIED_WORKFLOW_NAME: "CI Full Validation";
export const RELEASE_QUALIFIED_EVENTS: readonly ["workflow_dispatch", "schedule"];
export const REQUIRED_RELEASE_VALIDATION_JOBS: readonly string[];

export function selectReleaseQualifiedRun(
  payload: ReleaseWorkflowRunsPayload,
  expectedSha: string,
): ReleaseWorkflowRun;

export function assertReleaseQualifiedJobs(payload: ReleaseWorkflowJobsPayload): true;
