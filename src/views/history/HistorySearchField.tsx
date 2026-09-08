import { Search } from "lucide-react";
import type { ChangeEventHandler } from "react";
import { cn, focusWithinSurface, inputSurface } from "../../utils/tw";

export type HistorySearchMode = "operation" | "cleanup";

export interface HistorySearchFieldProps {
  mode: HistorySearchMode;
  value: string;
  placeholder: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

/** Shared by operation history and Safe Trash so every state keeps one stable icon/input DOM. */
export function HistorySearchField({ mode, value, placeholder, onChange }: HistorySearchFieldProps) {
  return (
    <label
      data-history-search-field="true"
      data-history-search-mode={mode}
      className={cn(
        inputSurface,
        "relative flex w-full items-center gap-2",
        focusWithinSurface
      )}
    >
      <Search
        data-history-search-icon="true"
        size={15}
        className="pointer-events-none shrink-0 text-[var(--zc-text-tertiary)]"
        aria-hidden="true"
        focusable="false"
      />
      <input
        data-history-search-input="true"
        value={value}
        onChange={onChange}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--zc-text-primary)] outline-none placeholder:text-[var(--zc-text-tertiary)]"
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
