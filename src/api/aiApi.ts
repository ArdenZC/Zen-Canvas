import { invokeCommand, listenTo, type EventHandler } from "./core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  AIClassificationProgressPayload,
  AIDebugClassificationResult,
  AIConnectionTestResult,
  AIModelInfo,
  AIProviderPreset,
  AIRequestTrace,
  AISettings,
  ClassificationCorrectionRequest,
  LibraryScope,
  RuleExecutionSummary,
  RuntimeCapabilities
} from "../types/domain";

export const aiApi = {
  classifyFilesWithAI(scope: LibraryScope, options?: { pendingOnly?: boolean; onlyUnclassified?: boolean; onlyLowConfidence?: boolean; limit?: number; force?: boolean; allowOverwriteUserCorrections?: boolean }): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("classify_files_with_ai", { scope, options: options ?? null });
  },
  classifySelectedFilesWithAI(fileIds: string[]): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("classify_selected_files_with_ai", { fileIds });
  },
  cancelAIClassification(): Promise<void> {
    return invokeCommand<void>("cancel_ai_classification");
  },
  confirmClassification(fileId: string): Promise<void> {
    return invokeCommand<void>("confirm_classification", { fileId });
  },
  correctClassification(fileId: string, correction: ClassificationCorrectionRequest): Promise<void> {
    return invokeCommand<void>("correct_classification", { fileId, correction });
  },
  getAISettings(): Promise<AISettings> {
    return invokeCommand<AISettings>("get_ai_settings");
  },
  getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return invokeCommand<RuntimeCapabilities>("get_runtime_capabilities");
  },
  saveAISettings(settings: AISettings): Promise<AISettings> {
    return invokeCommand<AISettings>("save_ai_settings", { settings });
  },
  listAIProviderPresets(): Promise<AIProviderPreset[]> {
    return invokeCommand<AIProviderPreset[]>("list_ai_provider_presets");
  },
  listAIModels(settings?: AISettings): Promise<AIModelInfo[]> {
    return invokeCommand<AIModelInfo[]>("list_ai_models", { settings: settings ?? null });
  },
  testAIProviderConnection(settings?: AISettings): Promise<AIConnectionTestResult> {
    return invokeCommand<AIConnectionTestResult>("test_ai_provider_connection", { settings: settings ?? null });
  },
  listAIRequestTraces(): Promise<AIRequestTrace[]> {
    return invokeCommand<AIRequestTrace[]>("list_ai_request_traces");
  },
  clearAIRequestTraces(): Promise<void> {
    return invokeCommand<void>("clear_ai_request_traces");
  },
  exportAIRequestTraces(): Promise<string> {
    return invokeCommand<string>("export_ai_request_traces");
  },
  debugAIClassificationOnce(target: string): Promise<AIDebugClassificationResult> {
    return invokeCommand<AIDebugClassificationResult>("debug_ai_classification_once", { target });
  },
  onAIClassificationProgress(handler: EventHandler<AIClassificationProgressPayload>): Promise<UnlistenFn> {
    return listenTo("ai-classification-progress", handler);
  }
};

export type AiApi = typeof aiApi;
