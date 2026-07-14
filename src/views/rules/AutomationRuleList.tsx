import { useRef, type KeyboardEvent, type RefObject } from "react";
import { LoaderCircle } from "lucide-react";
import type { Rule } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { cn } from "../../utils/tw";
import { ruleConditionSummary } from "../automation/automationModel";
import { toggleSwitch } from "../shared/ui";

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
    <ul ref={listRef} role="list" aria-label={t("automationRules")} className="grid gap-1 outline-none">
      {rules.map((rule, index) => {
        const active = rule.id === activeId;
        const busy = busyRuleIds.has(rule.id);
        return (
          <li key={rule.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--zc-radius-field)] border px-3 py-3 transition-colors", active ? "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)]" : "border-transparent hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-hover)]")}>
            <button
              ref={(element) => { rowRefs.current[rule.id] = element; }}
              type="button"
              data-rule-row-content
              data-rule-id={rule.id}
              className="min-w-0 text-left focus-visible:rounded-[var(--zc-radius-control)]"
              tabIndex={active || (!activeId && index === 0) ? 0 : -1}
              onFocus={() => onFocus(rule)}
              onKeyDown={(event) => handleContentKeyDown(event, index)}
              onClick={() => onSelect(rule)}
            >
              <strong className="block truncate text-sm">{rule.name}</strong>
              <span className="mt-1 block truncate text-xs text-[var(--muted)]">{rule.enabled ? t("automationEnabled") : t("automationPaused")}: {ruleConditionSummary(rule, t)}</span>
              {toggleErrorIds.has(rule.id) && <span className="mt-1 block text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationToggleFailed")}</span>}
            </button>
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
            ><i />{busy && <LoaderCircle size={13} aria-hidden="true" className="absolute right-1 top-1/2 -translate-y-1/2 animate-spin text-[var(--zc-primary-contrast)]" />}{busy && <span className="sr-only">{t("loading")}</span>}</button>
          </li>
        );
      })}
    </ul>
  );
}
