import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn, focusVisibleState } from "../../../utils/tw";
import { settingsField } from "./SettingsPrimitives";

export function SettingsSecretField({
  id,
  label,
  value,
  placeholder,
  showLabel,
  hideLabel,
  onChange,
  disabled = false,
  resetKey
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  showLabel: string;
  hideLabel: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  resetKey?: string | number;
}) {
  const [revealed, setRevealed] = useState(false);
  const toggleLabel = revealed ? hideLabel : showLabel;

  useEffect(() => {
    setRevealed(false);
  }, [resetKey]);

  return (
    <div className="grid min-w-0 gap-1.5" data-settings-secret-field data-settings-search-label={label}>
      <label htmlFor={id} className="text-sm font-medium text-[var(--zc-text-primary)]">{label}</label>
      <div className="relative min-w-0">
        <input
          id={id}
          className={cn(settingsField, "w-full pr-11")}
          type={revealed ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          data-settings-secret-toggle
          className={cn(
            "absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-[var(--zc-radius-control)] text-[var(--zc-text-secondary)]",
            "hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)]",
            focusVisibleState,
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          )}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-pressed={revealed}
          disabled={disabled}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
