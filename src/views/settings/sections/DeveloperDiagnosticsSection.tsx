import type { AIDebugClassificationResult, AIRequestTrace, AISettings } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { buttonSecondary, cn } from "../../../utils/tw";
import { compactPath } from "../../../utils/viewHelpers";
import { quietText } from "../../shared/ui";
import {
  SettingsControlGroup,
  SettingsDisclosure,
  SettingsInlineMessage,
  SettingsSelect,
  SettingsTextField,
  settingsField
} from "../components/SettingsPrimitives";

type DiagnosticTone = "success" | "warning";

export interface DeveloperDiagnosticsSectionProps {
  t: Translator;
  diagnosticsMode: AISettings["diagnosticsMode"];
  onDiagnosticsMode: (mode: AISettings["diagnosticsMode"]) => void;
  aiTraces: AIRequestTrace[];
  isLoadingAITraces: boolean;
  onRefreshAITraces: () => void;
  onExportAITraces: () => void;
  onClearAITraces: () => void;
  developerMode: boolean;
  aiDebugAvailable: boolean;
  selectedLibraryFile: { id: string; name: string; path: string } | undefined;
  aiDebugTarget: string;
  onAiDebugTarget: (value: string) => void;
  aiDependentControlsDisabled: boolean;
  isDebuggingAI: boolean;
  aiDebugStatus: { tone: DiagnosticTone; message: string; role?: "status" | "alert" } | null;
  aiDebugResult: AIDebugClassificationResult | null;
  apiKey: string;
  onUseSelectedFile: () => void;
  onDebug: () => void;
}

export function DeveloperDiagnosticsSection({
  t,
  diagnosticsMode,
  onDiagnosticsMode,
  aiTraces,
  isLoadingAITraces,
  onRefreshAITraces,
  onExportAITraces,
  onClearAITraces,
  developerMode,
  aiDebugAvailable,
  selectedLibraryFile,
  aiDebugTarget,
  onAiDebugTarget,
  aiDependentControlsDisabled,
  isDebuggingAI,
  aiDebugStatus,
  aiDebugResult,
  apiKey,
  onUseSelectedFile,
  onDebug
}: DeveloperDiagnosticsSectionProps) {
  return (
    <>
      <SettingsControlGroup title={t("aiDiagnosticsTitle")} description={t("aiDiagnosticsDesc")}>
        <SettingsSelect
          id="settings-ai-diagnostics-mode"
          label={t("aiDiagnosticsModeLabel")}
          description={t("aiDiagnosticsModeDesc")}
          value={diagnosticsMode ?? "off"}
          options={[
            { value: "off" as const, label: t("aiDiagnosticsOff") },
            { value: "failures" as const, label: t("aiDiagnosticsFailures") },
            { value: "all" as const, label: t("aiDiagnosticsAll") }
          ]}
          onChange={onDiagnosticsMode}
        />
        <SettingsInlineMessage tone="info">{t("aiDiagnosticsPathWarning")}</SettingsInlineMessage>
        <div className="flex flex-wrap gap-2">
          <button className={buttonSecondary} type="button" onClick={onRefreshAITraces} disabled={isLoadingAITraces}>
            {isLoadingAITraces ? t("aiInspectorLoading") : t("aiOpenRecentRequests")}
          </button>
          <button className={buttonSecondary} type="button" onClick={onExportAITraces} disabled={isLoadingAITraces}>
            {t("aiExportDiagnostics")}
          </button>
          <button className={buttonSecondary} type="button" onClick={onClearAITraces} disabled={isLoadingAITraces || aiTraces.length === 0}>
            {t("aiClearDiagnostics")}
          </button>
        </div>
        <SettingsDisclosure
          title={t("aiRequestInspectorTitle")}
          description={t("aiRequestInspectorDesc")}
          onOpenChange={(open) => { if (open) onRefreshAITraces(); }}
        >
          {aiTraces.length === 0 ? <span className={quietText}>{t("aiDiagnosticsEmpty")}</span> : (
            <div className="grid min-w-0 gap-3">
              {aiTraces.slice().reverse().map((trace) => (
                <details key={trace.traceId} className="grid min-w-0 gap-2 rounded-lg border border-[var(--zc-divider)] p-3">
                  <summary className="cursor-pointer text-xs font-medium text-[var(--zc-text-primary)]">
                    {trace.startedAt} · {trace.providerLabel} · {trace.model} · {trace.parseStage}
                    {trace.errorCode ? ` · ${trace.errorCode}` : ""}
                  </summary>
                  <div className="grid min-w-0 gap-2 text-xs text-[var(--zc-text-secondary)]">
                    <div className="grid gap-1">
                      <span>{t("aiTraceOverview")}: {trace.operation} · HTTP {trace.response.httpStatus ?? "—"} · {trace.elapsedMs}ms · {trace.traceId}</span>
                      <span>{t("aiTraceRequest")}: {trace.request.urlHost}{trace.request.path} · response_format={trace.request.responseFormat ?? "—"} · thinking={trace.request.thinkingMode ?? "—"} · max_tokens={trace.request.maxTokens ?? "—"}</span>
                    </div>
                    <AITraceValueBlock label={t("aiTraceRaw")} value={trace.rawProviderResponse} />
                    <AITraceValueBlock label={t("aiTraceExtracted")} value={trace.extractedContent} />
                    <AITraceValueBlock label={t("aiTraceCleaned")} value={trace.cleanedJsonText} />
                    <AITraceValueBlock label={t("aiTraceParsed")} value={trace.parsedJson} />
                    <AITraceValueBlock label={t("aiTraceErrorRetry")} value={trace.errorMessage ?? trace.errorCode} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </SettingsDisclosure>
      </SettingsControlGroup>

      {developerMode && aiDebugAvailable ? (
        <SettingsDisclosure title={t("aiDebugTitle")} description={t("aiDebugWarning")}>
          {selectedLibraryFile ? (
            <div className="grid gap-1 border-b border-[var(--zc-divider)] pb-3 text-xs text-[var(--zc-text-secondary)]">
              <span className="font-medium text-[var(--zc-text-primary)]">{t("aiSelectedFile")}</span>
              <span>{selectedLibraryFile.name}</span>
              <span title={selectedLibraryFile.path}>{compactPath(selectedLibraryFile.path, 96)}</span>
            </div>
          ) : <span className={quietText}>{t("aiNoSelectedFile")}</span>}
          <div className="grid min-w-0 gap-3 min-[1180px]:grid-cols-[minmax(0,1fr)_auto_auto] min-[1180px]:items-end">
            <SettingsTextField id="settings-ai-debug-target" label={t("aiDebugTargetLabel")} value={aiDebugTarget} disabled={aiDependentControlsDisabled} onChange={onAiDebugTarget} placeholder={t("aiDebugTargetPlaceholder")} />
            <button className={buttonSecondary} onClick={onUseSelectedFile} disabled={aiDependentControlsDisabled || !selectedLibraryFile || isDebuggingAI}>{t("aiUseSelectedFile")}</button>
            <button className={buttonSecondary} onClick={onDebug} disabled={aiDependentControlsDisabled || isDebuggingAI || !aiDebugTarget.trim()}>{isDebuggingAI ? t("aiDebugging") : t("aiDebugSingleFile")}</button>
          </div>
          {aiDebugStatus ? <SettingsInlineMessage tone={aiDebugStatus.tone} role={aiDebugStatus.role}>{sanitizeAIStatusMessage(aiDebugStatus.message, apiKey)}</SettingsInlineMessage> : null}
          {aiDebugResult ? (
            <div className="grid gap-3 text-xs text-[var(--zc-text-secondary)]">
              <div className="grid gap-1 border-b border-[var(--zc-divider)] pb-3">
                <span>{t("aiDebugProvider")}: {aiDebugResult.provider} / {aiDebugResult.preset}</span>
                <span>{t("aiDebugModel")}: {aiDebugResult.model}</span>
                <span>{t("aiDebugEndpoint")}: {aiDebugResult.baseUrl}{aiDebugResult.chatPath}</span>
                <span>{t("aiDebugHttp")}: {aiDebugResult.httpStatus} · response_format: {String(aiDebugResult.requestUsedResponseFormat)} · thinking: {aiDebugResult.requestUsedThinkingField ?? "—"}</span>
                <span>{t("aiDebugMaxTokens")}: {aiDebugResult.maxTokens} · {t("aiDebugBatchSize")}: {aiDebugResult.batchSize} · {t("aiDebugParseStage")}: {aiDebugResult.parseStage}</span>
                <span>{t("aiDebugRefId")}: {aiDebugResult.refId || "—"} · {t("aiDebugRealFileId")}: {aiDebugResult.realFileId || "—"} · {t("aiDebugIdMappingMatched")}: {String(aiDebugResult.idMappingMatched)}</span>
                <span>{t("aiDebugPath")}: {compactPath(aiDebugResult.path, 96)}</span>
                <span>{t("aiDebugMissingOptionalFields")}: {aiDebugResult.missingOptionalFields.length ? aiDebugResult.missingOptionalFields.join(", ") : "—"} · {t("aiDebugFallbackApplied")}: {String(aiDebugResult.fallbackApplied)}</span>
                <span>{t("aiDebugItemParseWarnings")}: {aiDebugResult.itemParseWarnings.length ? aiDebugResult.itemParseWarnings.join("; ") : "—"}</span>
              </div>
              <DebugPreviewBlock label={t("aiDebugResponseSummary")} value={aiDebugResult.providerResponseSummary} apiKey={apiKey} />
              <DebugPreviewBlock label={t("aiDebugRawResponsePreview")} value={aiDebugResult.rawResponsePreview} apiKey={apiKey} />
              <DebugPreviewBlock label={t("aiDebugMessageContentPreview")} value={aiDebugResult.messageContentPreview} apiKey={apiKey} />
              <DebugPreviewBlock label={t("aiDebugReasoningContentPreview")} value={aiDebugResult.reasoningContentPreview} apiKey={apiKey} />
              <DebugPreviewBlock label={t("aiDebugExtractedContentPreview")} value={aiDebugResult.extractedContentPreview} apiKey={apiKey} />
              <DebugPreviewBlock label={t("aiDebugCleanedContentPreview")} value={aiDebugResult.cleanedContentPreview} apiKey={apiKey} />
              <DebugPreviewBlock label={t("aiDebugParseError")} value={aiDebugResult.parseError ?? ""} apiKey={apiKey} />
            </div>
          ) : null}
        </SettingsDisclosure>
      ) : null}
    </>
  );
}

function sanitizeAIStatusMessage(message: string, apiKey: string) {
  const trimmed = apiKey.trim();
  return trimmed ? message.split(trimmed).join("[redacted]") : message;
}

function DebugPreviewBlock({ label, value, apiKey }: { label: string; value: string | null | undefined; apiKey: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-[var(--zc-text-primary)]">{label}</span>
      <pre className={cn(settingsField, "max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-5")}>
        {sanitizeAIStatusMessage(value || "—", apiKey)}
      </pre>
    </label>
  );
}

function AITraceValueBlock({ label, value }: { label: string; value: unknown }) {
  const displayValue = typeof value === "string" ? value : value == null ? "—" : JSON.stringify(value, null, 2);
  return (
    <label className="grid min-w-0 gap-1">
      <span className="font-medium text-[var(--zc-text-primary)]">{label}</span>
      <pre className={cn(settingsField, "max-h-56 overflow-auto whitespace-pre-wrap break-words p-2 text-[11px] leading-5")}>{displayValue}</pre>
    </label>
  );
}
