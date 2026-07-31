import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Loader2,
  Pencil,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2
} from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { isBrowserMockEnabled } from "../../api/browserMockApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { resolveLegacyLibraryScope } from "../../store/useFileLibraryV2Store";
import { useRuleProposalStore } from "../../store/useRuleProposalStore";
import type { AISettings, Rule, RuleProposal } from "../../types/domain";
import { buttonGhost, buttonSecondary, cn, contentPanel, glassButtonPrimary, inputSurface, selectSurface } from "../../utils/tw";
import { readableError } from "../../utils/viewHelpers";
import { ConfirmDialog, mutedText, panelSurface } from "../shared/ui";

interface Props {
  rules: Rule[];
  onOpenManualBuilder: (trigger: HTMLElement) => void;
  onEditCandidate: (proposal: RuleProposal, trigger: HTMLElement) => void;
}

const copy = {
  en: {
    title: "Describe a rule",
    subtitle: "Turn plain language into a reviewable draft. AI can only propose a rule.",
    privacy: "Only the text you enter is sent. File contents are never sent.",
    manual: "Manual rule builder",
    prompt: "Describe the files to match and the classification suggestion…",
    generate: "Generate proposal",
    update: "Update an existing rule",
    create: "Create a new rule",
    target: "Rule to update",
    examples: "Examples: “PDF files older than 30 days” · “Images larger than 500 MB”",
    history: "Proposals",
    empty: "No saved proposals yet.",
    preview: "Preview metadata impact",
    exact: "Resolve exact count",
    apply: "Apply as disabled rule",
    applyTitle: "Apply this proposal?",
    applyDescription: "This creates or updates a disabled rule only. It does not run the rule or change any file.",
    applySafety: "Enabling and running remain separate human actions.",
    cancel: "Cancel",
    delete: "Delete proposal",
    edit: "Edit candidate",
    regenerate: "Regenerate",
    matched: "matched metadata rows",
    deferred: "Exact count is deferred. Resolve it before Apply.",
    applied: "Rule saved, currently disabled. Review it, then enable or run separately.",
    providerOff: "No AI provider is enabled. Use the manual builder or configure AI settings.",
    noCandidate: "The model needs clarification before it can produce a candidate.",
    samples: "Bounded metadata sample",
    conflicts: "Potential enabled-rule conflicts",
    validation: "Backend validation",
    generating: "Generating with the configured provider…",
    mock: "Browser preview uses a deterministic mock and is not real AI or native persistence."
  },
  zh: {
    title: "用自然语言描述规则",
    subtitle: "把普通文字转换成可审查草稿。AI 只能提出建议。",
    privacy: "只发送你输入的文字，不发送文件内容。",
    manual: "手动规则构建器",
    prompt: "描述要匹配的文件，以及希望生成的分类建议…",
    generate: "生成提案",
    update: "更新现有规则",
    create: "新建规则",
    target: "要更新的规则",
    examples: "示例：“30 天前的 PDF 文件” · “大于 500 MB 的图片”",
    history: "提案记录",
    empty: "还没有持久化提案。",
    preview: "预览元数据影响",
    exact: "解析精确数量",
    apply: "应用为禁用规则",
    applyTitle: "应用这个提案？",
    applyDescription: "这里只会创建或更新一条默认禁用的规则，不会运行规则，也不会修改任何文件。",
    applySafety: "启用和运行仍是两个独立的人工动作。",
    cancel: "取消",
    delete: "删除提案",
    edit: "编辑候选规则",
    regenerate: "重新生成",
    matched: "条元数据记录匹配",
    deferred: "精确数量尚未计算；Apply 前必须单独解析。",
    applied: "已应用为禁用规则。请另行审查、启用和运行。",
    providerOff: "尚未启用 AI provider。可使用手动构建器，或前往设置配置。",
    noCandidate: "模型需要澄清，尚未形成候选规则。",
    samples: "有界元数据样本",
    conflicts: "潜在的已启用规则冲突",
    validation: "后端权威校验",
    generating: "正在使用已配置 provider 生成…",
    mock: "浏览器预览使用明确标记的确定性 mock，不代表真实 AI 或原生持久化。"
  }
} as const;

export function RuleProposalWorkspace({ rules, onOpenManualBuilder, onEditCandidate }: Props) {
  const { language } = useChromeContext();
  const text = copy[language === "zh" ? "zh" : "en"];
  const scope = useFileLibraryStore((state) => state.scope);
  const proposals = useRuleProposalStore((state) => state.proposals);
  const activeId = useRuleProposalStore((state) => state.activeId);
  const impact = useRuleProposalStore((state) => state.impact);
  const busy = useRuleProposalStore((state) => state.busy);
  const generationOwner = useRuleProposalStore((state) => state.generationOwner);
  const error = useRuleProposalStore((state) => state.error);
  const load = useRuleProposalStore((state) => state.load);
  const select = useRuleProposalStore((state) => state.select);
  const generate = useRuleProposalStore((state) => state.generate);
  const regenerate = useRuleProposalStore((state) => state.regenerate);
  const cancelActiveGeneration = useRuleProposalStore((state) => state.cancelActiveGeneration);
  const cancel = useRuleProposalStore((state) => state.cancel);
  const preview = useRuleProposalStore((state) => state.preview);
  const resolveExact = useRuleProposalStore((state) => state.resolveExact);
  const apply = useRuleProposalStore((state) => state.apply);
  const deleteProposal = useRuleProposalStore((state) => state.deleteProposal);
  const clearError = useRuleProposalStore((state) => state.clearError);
  const [prompt, setPrompt] = useState("");
  const [intent, setIntent] = useState<"create" | "update">("create");
  const [targetRuleId, setTargetRuleId] = useState("");
  const [provider, setProvider] = useState<AISettings | null>(null);
  const [providerError, setProviderError] = useState("");
  const [confirmApply, setConfirmApply] = useState(false);
  const active = proposals.find((proposal) => proposal.id === activeId) ?? proposals[0] ?? null;
  const targetRule = rules.find((rule) => rule.id === targetRuleId);
  const providerLabel = provider
    ? `${provider.preset} · ${provider.model || "—"}`
    : "—";

  useEffect(() => {
    void load();
    let cancelled = false;
    tauriApi.getAISettings()
      .then((settings) => { if (!cancelled) setProvider(settings); })
      .catch((reason) => { if (!cancelled) setProviderError(readableError(reason)); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (intent === "update" && !targetRuleId) setTargetRuleId(rules[0]?.id ?? "");
  }, [intent, rules, targetRuleId]);

  const canGenerate = prompt.trim().length > 0
    && prompt.trim().length <= 4_000
    && (intent === "create" || Boolean(targetRule));
  const canPreview = active?.status === "ready" && active.validation.permissionClass !== "deny";
  const canApply = canPreview
    && impact?.proposalId === active?.id
    && impact.impactState === "exact"
    && impact.permissionClass !== "deny";
  const terminalDelete = active
    && ["applied", "cancelled", "invalid", "failed"].includes(active.status);
  const currentTarget = active?.targetRuleId
    ? rules.find((rule) => rule.id === active.targetRuleId)
    : undefined;

  async function submitGeneration() {
    if (!canGenerate) return;
    clearError();
    await generate(prompt.trim(), intent === "update" ? targetRule : undefined);
  }

  async function runPreview() {
    if (!active) return;
    const durableScope = await resolveLegacyLibraryScope(scope);
    await preview(active, durableScope);
  }

  return (
    <section className={cn(panelSurface, "grid gap-4 p-4")} aria-labelledby="rule-proposal-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-[var(--zc-primary)]" />
            <h2 id="rule-proposal-title" className="text-sm font-semibold">{text.title}</h2>
          </div>
          <p className={cn(mutedText, "mt-1")}>{text.subtitle}</p>
        </div>
        <button type="button" className={buttonSecondary} onClick={(event) => onOpenManualBuilder(event.currentTarget)}>
          <Pencil size={15} />{text.manual}
        </button>
      </div>

      <div className={cn(contentPanel, "grid gap-3 p-3")}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Bot size={15} aria-hidden="true" />
          <span>{providerLabel}</span>
          <span className="text-[var(--muted)]">·</span>
          <span className="inline-flex items-center gap-1 text-[var(--zc-success-text)]">
            <ShieldCheck size={14} />{text.privacy}
          </span>
        </div>
        {provider && !provider.enabled && (
          <p
            className="text-sm text-[var(--zc-warning-text)]"
            data-proposal-status="provider-disabled"
            aria-live="polite"
          >
            {text.providerOff}
          </p>
        )}
        {providerError && <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{providerError}</p>}
        <div className="grid gap-2 md:grid-cols-[170px_minmax(0,1fr)]">
          <select
            className={selectSurface}
            aria-label={language === "zh" ? "提案类型" : "Proposal intent"}
            value={intent}
            onChange={(event) => setIntent(event.target.value as "create" | "update")}
          >
            <option value="create">{text.create}</option>
            <option value="update">{text.update}</option>
          </select>
          {intent === "update" && (
            <select
              className={selectSurface}
              aria-label={text.target}
              value={targetRuleId}
              onChange={(event) => setTargetRuleId(event.target.value)}
            >
              {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
            </select>
          )}
        </div>
        <textarea
          className={cn(inputSurface, "min-h-24 resize-y")}
          maxLength={4_000}
          aria-label={text.title}
          placeholder={text.prompt}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn(mutedText, "text-xs")}>{text.examples}</p>
          <span className="text-xs tabular-nums text-[var(--muted)]">{prompt.length}/4000</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={glassButtonPrimary}
            disabled={!canGenerate || busy}
            onClick={() => void submitGeneration()}
          >
            {generationOwner ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {text.generate}
          </button>
          {generationOwner && (
            <button type="button" className={buttonSecondary} onClick={() => void cancelActiveGeneration()}>
              <Square size={14} />{text.cancel}
            </button>
          )}
        </div>
        {generationOwner && (
          <p className={mutedText} data-proposal-status="generating" aria-live="polite">
            {text.generating}
          </p>
        )}
        {isBrowserMockEnabled() && <p className={mutedText}>{text.mock}</p>}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--zc-danger-border)] bg-[var(--zc-danger-bg)] p-3 text-sm text-[var(--zc-danger-text)]" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]">
        <div className="grid content-start gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{text.history}</h3>
            <span className="text-xs tabular-nums text-[var(--muted)]">{proposals.length}</span>
          </div>
          {proposals.length === 0 ? <p className={cn(contentPanel, "p-3 text-sm text-[var(--muted)]")}>{text.empty}</p> : (
            <ul className="grid max-h-80 gap-2 overflow-auto" aria-label={text.history}>
              {proposals.map((proposal) => (
                <li key={proposal.id}>
                  <button
                    type="button"
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-3 text-left",
                      proposal.id === active?.id
                        ? "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)]"
                        : "border-[var(--zc-divider)] bg-[var(--zc-panel)]"
                    )}
                    onClick={() => void select(proposal.id)}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{proposal.candidate?.name ?? proposal.prompt}</strong>
                      <span className="mt-1 block text-xs text-[var(--muted)]">{proposal.status} · r{proposal.revision}</span>
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(contentPanel, "grid min-w-0 content-start gap-3 p-4")} aria-live="polite">
          {!active ? <p className={mutedText}>{text.empty}</p> : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {active.status === "applied" ? <CheckCircle2 size={16} className="text-[var(--zc-success-text)]" /> : <FileSearch size={16} />}
                    <h3 className="font-semibold">{active.candidate?.name ?? active.prompt}</h3>
                  </div>
                  <p className={cn(mutedText, "mt-1 text-xs")}>
                    {active.providerPreset ?? "manual"} · {active.model ?? "—"} · {active.validation.permissionClass}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--zc-divider)] px-2 py-1 text-xs">{active.status}</span>
              </div>

              {active.summary && <p className="whitespace-pre-wrap text-sm">{active.summary}</p>}
              {active.status === "applied" && (
                <p className="rounded-lg bg-[var(--zc-success-soft)] p-3 text-sm text-[var(--zc-success-text)]">{text.applied}</p>
              )}
              {active.clarifications.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {active.clarifications.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                </ul>
              )}
              {!active.candidate && active.status !== "applied" && <p className={mutedText}>{text.noCandidate}</p>}
              {active.candidate && (
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">{text.validation}</strong>
                    <button type="button" className={buttonGhost} onClick={(event) => onEditCandidate(active, event.currentTarget)}>
                      <Pencil size={14} />{text.edit}
                    </button>
                  </div>
                  <div className="grid gap-2 text-sm">
                    {active.candidate.groups.map((group) => (
                      <div key={group.id} className="rounded-lg border border-[var(--zc-divider)] p-2">
                        <span className="text-xs font-semibold">{group.operator}</span>
                        {group.conditions.map((condition) => (
                          <p key={condition.id} className="mt-1 break-words font-mono text-xs">
                            {condition.field} {condition.operator} {JSON.stringify(condition.value)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                  {[...active.validation.codes, ...active.validation.warnings].map((code) => (
                    <p key={code} className="text-xs text-[var(--zc-warning-text)]">{code}</p>
                  ))}
                </div>
              )}

              {impact?.proposalId === active.id && (
                <div className="grid gap-2 rounded-lg border border-[var(--zc-divider)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">
                      {impact.matchedCount?.toLocaleString() ?? "—"} {text.matched}
                    </strong>
                    <span className="text-xs">{impact.impactState}</span>
                  </div>
                  {impact.impactState === "deferred" && <p className={mutedText}>{text.deferred}</p>}
                  {impact.sampleRows.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold">{text.samples} (≤20)</p>
                      <ul className="grid max-h-40 gap-1 overflow-auto text-xs">
                        {impact.sampleRows.map((sample) => (
                          <li key={sample.fileId} className="flex justify-between gap-3 rounded bg-[var(--zc-panel)] px-2 py-1">
                            <span className="truncate">{sample.name}</span>
                            <span className="shrink-0 tabular-nums">{sample.size.toLocaleString()} B</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {impact.conflicts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold">{text.conflicts}</p>
                      {impact.conflicts.map((conflict) => <p key={conflict.ruleId} className="text-xs text-[var(--zc-warning-text)]">{conflict.name}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-[var(--zc-divider)] pt-3">
                {canPreview && (
                  <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void runPreview()}>
                    <FileSearch size={14} />{text.preview}
                  </button>
                )}
                {impact?.proposalId === active.id && impact.impactState === "deferred" && (
                  <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void resolveExact(active)}>
                    <Loader2 size={14} className={busy ? "animate-spin" : ""} />{text.exact}
                  </button>
                )}
                <button type="button" className={glassButtonPrimary} disabled={!canApply || busy} onClick={() => setConfirmApply(true)}>
                  <CheckCircle2 size={14} />{text.apply}
                </button>
                {["needs_clarification", "invalid", "failed", "stale"].includes(active.status) && (
                  <button type="button" className={buttonSecondary} disabled={busy || !prompt.trim()} onClick={() => void regenerate(active, prompt.trim(), currentTarget)}>
                    <Sparkles size={14} />{text.regenerate}
                  </button>
                )}
                {!["applied", "cancelled"].includes(active.status) && active.status !== "generating" && (
                  <button type="button" className={buttonGhost} disabled={busy} onClick={() => void cancel(active)}>
                    <Square size={14} />{text.cancel}
                  </button>
                )}
                {terminalDelete && (
                  <button type="button" className={buttonGhost} disabled={busy} onClick={() => void deleteProposal(active)}>
                    <Trash2 size={14} />{text.delete}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmApply}
        tone="warning"
        title={text.applyTitle}
        description={text.applyDescription}
        emphasis={text.applySafety}
        confirmLabel={text.apply}
        cancelLabel={text.cancel}
        isProcessing={busy}
        onCancel={() => setConfirmApply(false)}
        onConfirm={() => {
          if (!active) return;
          void apply(active).then(() => setConfirmApply(false));
        }}
      />
    </section>
  );
}
