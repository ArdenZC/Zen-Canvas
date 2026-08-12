import { invokeCommand, listenTo, type EventHandler } from "./core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  AnalysisDetector,
  AnalysisDetectorDescriptor,
  AnalysisFinding,
  AnalysisFindingDecision,
  AnalysisFindingEvidence,
  AnalysisFindingPage,
  AnalysisRun,
  DedupeAuthority,
  StartAnalysisRunRequest
} from "../types/domain";
import type { AnalysisRun as AnalysisRunEvent } from "../types/domain";

export const analysisApi = {
  listAnalysisDetectors(): Promise<AnalysisDetectorDescriptor[]> {
    return invokeCommand<AnalysisDetectorDescriptor[]>("list_analysis_detectors");
  },
  startAnalysisRun(request: StartAnalysisRunRequest): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("start_analysis_run", { request });
  },
  cancelAnalysisRun(runId: string): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("cancel_analysis_run", { runId });
  },
  retryAnalysisRun(runId: string): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("retry_analysis_run", { runId });
  },
  getAnalysisRun(runId: string): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("get_analysis_run", { runId });
  },
  getActiveAnalysisRun(): Promise<AnalysisRun | null> {
    return invokeCommand<AnalysisRun | null>("get_active_analysis_run");
  },
  listAnalysisRuns(limit = 20): Promise<AnalysisRun[]> {
    return invokeCommand<AnalysisRun[]>("list_analysis_runs", { limit });
  },
  listAnalysisRunDetectors(runId: string): Promise<AnalysisDetector[]> {
    return invokeCommand<AnalysisDetector[]>("list_analysis_run_detectors", { runId });
  },
  listAnalysisFindings(options: { runId?: string; detectorId?: string; tier?: string; category?: string; decision?: string; status?: string; executableOnly?: boolean; cursor?: string | null; limit?: number } = {}): Promise<AnalysisFindingPage> {
    return invokeCommand<AnalysisFindingPage>("list_analysis_findings", {
      runId: options.runId ?? null,
      detectorId: options.detectorId ?? null,
      tier: options.tier ?? null,
      category: options.category ?? null,
      decision: options.decision ?? null,
      status: options.status ?? null,
      executableOnly: options.executableOnly ?? false,
      cursor: options.cursor ?? null,
      limit: options.limit ?? 100
    });
  },
  getAnalysisFinding(findingId: string): Promise<AnalysisFinding | null> {
    return invokeCommand<AnalysisFinding | null>("get_analysis_finding", { findingId });
  },
  listAnalysisFindingEvidence(findingId: string): Promise<AnalysisFindingEvidence[]> {
    return invokeCommand<AnalysisFindingEvidence[]>("list_analysis_finding_evidence", { findingId });
  },
  getDedupeAuthority(): Promise<DedupeAuthority> {
    return invokeCommand<DedupeAuthority>("get_dedupe_authority");
  },
  setAnalysisFindingDecision(request: { findingKey: string; decision: AnalysisFindingDecision["decision"]; snoozedUntil?: number | null; note?: string | null; expectedRevision: number }): Promise<AnalysisFindingDecision> {
    return invokeCommand<AnalysisFindingDecision>("set_analysis_finding_decision", {
      findingKey: request.findingKey,
      decision: request.decision,
      snoozedUntil: request.snoozedUntil ?? null,
      note: request.note ?? null,
      expectedRevision: request.expectedRevision
    });
  },
  revalidateAnalysisFinding(findingId: string): Promise<AnalysisFinding> {
    return invokeCommand<AnalysisFinding>("revalidate_analysis_finding", { findingId });
  },
  onAnalysisRunUpdated(handler: EventHandler<AnalysisRunEvent>): Promise<UnlistenFn> {
    return listenTo("analysis-run-updated", handler);
  },
  onAnalysisDetectorUpdated(handler: EventHandler<AnalysisDetector>): Promise<UnlistenFn> {
    return listenTo("analysis-detector-updated", handler);
  },
  onAnalysisFindingsPublished(handler: EventHandler<AnalysisRunEvent>): Promise<UnlistenFn> {
    return listenTo("analysis-findings-published", handler);
  }
};

export type AnalysisApi = typeof analysisApi;
