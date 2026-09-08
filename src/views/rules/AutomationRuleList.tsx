import { useRef, type KeyboardEvent, type RefObject } from "react";
import { LoaderCircle } from "lucide-react";
import type { Rule } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { cn, focusVisibleState, selectedSurface } from "../../utils/tw";
import { ruleConditionSummary } from "../automation/automationModel";
import { switchThumb, toggleSwitch } from "../shared/ui";

export function focusRuleContent(listRef: RefObject<HTMLUListElement | null>, id: string) {
  const target = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-rule-row-content]") ?? [])
    .find((button) => button.dataset.ruleId === id);
  target?.focus();
  return Boolean(target);
}

export function AutomationRuleList({ rules, activeId, busyRuleIds, toggleErrorIds, listRef, onSelect, onFocus, onToggle, t }: {
  rules: readonly Rule[];
  activeId: string;
  busyRuleIds: ReadonlySet<string>;
  toggleErrorIds: ReadonlySet<string>;
  listRef: RefObject<HTMLUListElement | null>;
  onSelect: (rule: Rule) => void;
  onFocus: (rule: Rule) => void;
  onToggle: (rule: Rule, enabled: boolean) => void;
  t: Translator;
}) {
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function moveFocus(index: number, delta: number) {
    const nextIndex = Math.min(rules.length - 1, Math.max(0, index + delta));
    const next = rules[nextIndex];
    if (!next) return;
    onFocus(next);
    rowRefs.current[next.id]?.focus();
  }

  function handleContentKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index, -1);
    }
  }

  return (
    <div className="grid min-w-0 gap-1 overflow-x-auto" data-automation-rule-table="true">
      <div className="hidden min-w-[26rem] grid-cols-[minmax(0,1.35fr)_minmax(7rem,.7fr)_auto] gap-3 px-3 text-[11px] font-semibold text-[var(--zc-text-tertiary)] sm:grid" aria-hidden="true">
        <span>{t("ruleName")}</span>
        <span>{t("automationTrigger")}</span>
        <span>{t("automationStatus")}</span>
      </div>
      <ul ref={listRef} role="list" aria-label={t("automationRules")} className="grid min-w-[26rem] gap-1 outline-none">
      {rules.map((rule, index) => {
        const active = rule.id === activeId;
        const busy = busyRuleIds.has(rule.id);
        return (
          <li key={rule.id} className={cn("grid grid-cols-[minmax(0,1.35fr)_minmax(7rem,.7fr)_auto] items-center gap-3 rounded-[var(--zc-radius-field)] border px-3 py-3 transition-colors", active ? selectedSurface : "border-transparent hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-hover)]")}>
            <button
              ref={(element) => { rowRefs.current[rule.id] = element; }}
              type="button"
              data-rule-row-content
              data-rule-id={rule.id}
              className={cn("min-w-0 text-left focus-visible:rounded-[var(--zc-radius-control)]", focusVisibleState)}
              tabIndex={active || (!activeId && index === 0) ? 0 : -1}
              onFocus={() => onFocus(rule)}
              onKeyDown={(event) => handleContentKeyDown(event, index)}
              onClick={() => onSelect(rule)}
            >
              <strong className="block truncate text-sm">{rule.name}</strong>
              <span className="mt-1 block truncate text-xs text-[var(--muted)]">{ruleConditionSummary(rule, t)}</span>
              {toggleErrorIds.has(rule.id) && <span className="mt-1 block text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationToggleFailed")}</span>}
            </button>
            <span className="hidden truncate text-xs text-[var(--zc-text-secondary)] sm:block" title={t("automationTriggerHint")}>{t("automationManualTrigger")}</span>
            <span className="flex min-w-0 items-center justify-end gap-2">
              <span className="hidden truncate text-xs text-[var(--zc-text-secondary)] sm:block">{rule.enabled ? t("automationEnabled") : t("automationPaused")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={rule.enabled}
              aria-busy={busy}
              aria-label={rule.enabled ? t("disableRule") : t("enableRule")}
              data-loading={busy ? "true" : undefined}
              className={cn(toggleSwitch(rule.enabled), busy && "cursor-wait")}
              disabled={busy}
              onClick={(event) => { event.stopPropagation(); onToggle(rule, !rule.enabled); }}
              onKeyDown={(event) => event.stopPropagation()}
            ><i className={switchThumb} />{busy && <LoaderCircle size={13} aria-hidden="true" className="absolute right-1 top-1/2 -translate-y-1/2 animate-spin text-[var(--zc-primary-contrast)]" />}{busy && <span className="sr-only">{t("loading")}</span>}</button>
            </span>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
