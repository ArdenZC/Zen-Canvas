import { invokeCommand } from "./core";
import type {
  ActiveContentRunForFile,
  ContentArtifact,
  ContentArtifactPage,
  ContentPreview,
  ContentPreviewRequest,
  ContentRun,
  ContentRunItem,
  ContentScopePolicy,
  FileLibraryScopeV2
} from "../types/domain";

export const contentApi = {
  getContentScopePolicy(rootId: string): Promise<ContentScopePolicy> {
    return invokeCommand<ContentScopePolicy>("get_content_scope_policy", { rootId });
  },
  getContentCatalogRevision(): Promise<number> {
    return invokeCommand<number>("get_content_catalog_revision");
  },
  setContentScopePolicy(request: { version: 1; rootId: string; expectedRootRevision: number; expectedPolicyRevision: number; confirmed: boolean; policy: ContentScopePolicy }): Promise<ContentScopePolicy> {
    return invokeCommand<ContentScopePolicy>("set_content_scope_policy", { request });
  },
  previewContent(request: ContentPreviewRequest): Promise<ContentPreview> {
    return invokeCommand<ContentPreview>("preview_content", { request });
  },
  startContentRun(request: ContentPreviewRequest & { previewFingerprint: string; confirmed: boolean }): Promise<ContentRun> {
    return invokeCommand<ContentRun>("start_content_run", { request });
  },
  getContentRun(runId: string): Promise<ContentRun> {
    return invokeCommand<ContentRun>("get_content_run", { runId });
  },
  listContentRuns(limit = 50, cursor?: string | null): Promise<ContentRun[]> {
    return invokeCommand<ContentRun[]>("list_content_runs", { request: { limit, cursor: cursor ?? null } });
  },
  getActiveContentRunForFile(fileId: string): Promise<ActiveContentRunForFile | null> {
    return invokeCommand<ActiveContentRunForFile | null>("get_active_content_run_for_file", { fileId });
  },
  cancelContentRun(runId: string, expectedRevision: number, confirmed = true): Promise<ContentRun> {
    return invokeCommand<ContentRun>("cancel_content_run", { request: { runId, expectedRevision, confirmed } });
  },
  queryContentRunItems(runId: string, limit = 100, cursor?: number | null): Promise<{ runId: string; items: ContentRunItem[]; nextCursor: number | null; hasMore: boolean }> {
    return invokeCommand("query_content_run_items", { request: { runId, limit, cursor: cursor ?? null } });
  },
  getContentArtifact(fileId: string): Promise<ContentArtifact | null> {
    return invokeCommand<ContentArtifact | null>("get_content_artifact", { fileId });
  },
  queryContentArtifacts(request: { query: string; scope: FileLibraryScopeV2; expectedLibraryRevision: number; expectedContentRevision: number; limit: number; cursor?: string | null }): Promise<ContentArtifactPage> {
    return invokeCommand<ContentArtifactPage>("query_content_artifacts", { request });
  },
  rebuildContentArtifact(fileId: string, expectedRevision: number, confirmed = true): Promise<ContentArtifact> {
    return invokeCommand<ContentArtifact>("rebuild_content_artifact", { request: { fileId, expectedRevision, confirmed } });
  },
  deleteContentArtifact(fileId: string, expectedRevision: number, confirmed = true): Promise<boolean> {
    return invokeCommand<boolean>("delete_content_artifact", { request: { fileId, expectedRevision, confirmed } });
  },
  purgeContentScope(request: { version: 1; scope: FileLibraryScopeV2; expectedLibraryRevision: number; expectedPolicyRevisions: Array<{ rootId: string; rootRevision: number; policyRevision: number }>; confirmed: boolean }): Promise<number> {
    return invokeCommand<number>("purge_content_scope", { request });
  },
  understandContentArtifacts(request: { version: 1; artifactIds: string[]; expectedRevisions: number[]; runId: string; expectedRunRevision: number; confirmed: boolean }): Promise<{ processedCount: number; blockedCount: number; reason: string | null }> {
    return invokeCommand("understand_content_artifacts", { request });
  }
};

export type ContentApi = typeof contentApi;
