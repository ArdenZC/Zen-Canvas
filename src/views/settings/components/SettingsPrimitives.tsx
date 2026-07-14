import { useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cn } from "../../../utils/tw";

export type SettingsSectionOption = {
  id: string;
  label: string;
};

type SectionChangeOptions = {
  focusContent?: boolean;
};

const focusVisible =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";

const settingsControl = cn(
  "min-h-10 rounded-[var(--zc-radius-control)] border border-[var(--zc-control-border)] bg-[var(--zc-surface)] px-3 text-sm text-[var(--zc-text-primary)]",
  "transition-[background,border-color,box-shadow,color] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]",
  "hover:border-[var(--zc-control-border-hover)] focus:border-[var(--zc-primary)] focus:bg-[var(--zc-surface)]",
  "focus:shadow-[0_0_0_3px_var(--zc-focus-ring-soft)]",
  focusVisible,
  "disabled:cursor-not-allowed disabled:border-[var(--zc-control-border)] disabled:bg-[var(--zc-surface-subtle)] disabled:text-[var(--zc-text-disabled)] disabled:opacity-70"
);

export const settingsField = settingsControl;
export const settingsSelect = cn(settingsControl, "appearance-auto");

export function SettingsLayout({
  sections,
  activeSectionId,
  onSectionChange,
  scrollRef,
  sectionLabel,
  children
}: {
  sections: SettingsSectionOption[];
  activeSectionId: string;
  onSectionChange: (sectionId: string, options?: SectionChangeOptions) => void;
  scrollRef?: RefObject<HTMLDivElement | null>;
  sectionLabel: string;
  children: ReactNode;
}) {
  return (
    <div ref={scrollRef} data-settings-scroll-container className="h-full min-h-0 min-w-0 overflow-auto overscroll-contain pr-1">
      <div className="mx-auto grid w-full max-w-[1200px] min-w-0 gap-5 px-1 pb-8 min-[1180px]:grid-cols-[minmax(190px,220px)_minmax(0,960px)] min-[1180px]:items-start">
        <SettingsSectionNav
          sections={sections}
          activeSectionId={activeSectionId}
          onSectionChange={onSectionChange}
          sectionLabel={sectionLabel}
        />
        <div className="grid min-w-0 gap-7">{children}</div>
      </div>
    </div>
  );
}

export function SettingsSectionNav({
  sections,
  activeSectionId,
  onSectionChange,
  sectionLabel
}: {
  sections: SettingsSectionOption[];
  activeSectionId: string;
  onSectionChange: (sectionId: string, options?: SectionChangeOptions) => void;
  sectionLabel: string;
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
    const isPrevious = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!isNext && !isPrevious && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? sections.length - 1
        : (index + (isNext ? 1 : -1) + sections.length) % sections.length;
    const next = sections[nextIndex];
    onSectionChange(next.id, { focusContent: false });
    window.requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus());
  }

  return (
    <aside className="min-w-0 min-[1180px]:sticky min-[1180px]:top-4 min-[1180px]:self-start">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--zc-text-tertiary)]">
        {sectionLabel}
      </p>
      <nav
        aria-label={sectionLabel}
        data-settings-section-nav
        className="flex max-w-full gap-1 overflow-x-auto overscroll-contain pb-1 min-[1180px]:grid min-[1180px]:overflow-visible"
      >
        {sections.map((section, index) => {
          const active = activeSectionId === section.id;
          return (
            <button
              key={section.id}
              ref={(element) => { buttonRefs.current[index] = element; }}
              type="button"
              data-settings-section={section.id}
              aria-current={active ? "location" : undefined}
              tabIndex={active ? 0 : -1}
              className={cn(
                "min-h-9 shrink-0 whitespace-nowrap rounded-[var(--zc-radius-control)] border border-transparent px-3 py-2 text-left text-sm font-medium text-[var(--zc-text-secondary)]",
                "transition-[background,border-color,color] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]",
                "hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)]",
                focusVisible,
                active && "border-[var(--zc-divider)] bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]"
              )}
              onClick={() => onSectionChange(section.id)}
              onKeyDown={(event) => moveFocus(event, index)}
            >
              {section.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function SettingsSection({
  id,
  title,
  description,
  children
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-heading`}
      data-settings-section-content
      className="grid min-w-0 gap-4 border-b border-[var(--zc-divider)] pb-7 outline-none last:border-b-0"
    >
      <header className="grid gap-1">
        <h2 id={`${id}-heading`} data-settings-section-heading tabIndex={-1} className="text-lg font-semibold tracking-[-0.01em] text-[var(--zc-text-primary)] outline-none">
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-[var(--zc-text-secondary)]">{description}</p> : null}
      </header>
      <div className="grid min-w-0 gap-0">{children}</div>
    </section>
  );
}

export function SettingsControlGroup({
  title,
  description,
  children
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-3 border-t border-[var(--zc-divider)] pt-5 first:border-t-0 first:pt-0">
      {title ? <h3 className="text-sm font-semibold text-[var(--zc-text-primary)]">{title}</h3> : null}
      {description ? <p className="max-w-2xl text-sm leading-6 text-[var(--zc-text-secondary)]">{description}</p> : null}
      <div className="grid min-w-0 gap-0">{children}</div>
    </div>
  );
}

export function SettingsRow({
  id,
  label,
  description,
  hint,
  children,
  className
}: {
  id?: string;
  label: string;
  description?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-3 border-b border-[var(--zc-divider)] py-4 last:border-b-0 min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,360px)] min-[720px]:items-start", className)}>
      <div className="min-w-0">
        {id ? (
          <label htmlFor={id} className="block text-sm font-medium text-[var(--zc-text-primary)]">{label}</label>
        ) : (
          <strong className="block text-sm font-medium text-[var(--zc-text-primary)]">{label}</strong>
        )}
        {description ? <span className="mt-1 block max-w-[600px] text-sm leading-6 text-[var(--zc-text-secondary)]">{description}</span> : null}
        {hint ? <span className="mt-1 block max-w-[600px] text-xs leading-5 text-[var(--zc-text-tertiary)]">{hint}</span> : null}
      </div>
      <div className="min-w-0 min-[720px]:justify-self-end min-[720px]:w-full min-[720px]:max-w-[360px]">{children}</div>
    </div>
  );
}

export function SettingsSegmentedControl<T extends string>({
  value,
  options,
  ariaLabel,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
    const isPrevious = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!isNext && !isPrevious && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : (index + (isNext ? 1 : -1) + options.length) % options.length;
    const next = options[nextIndex];
    onChange(next.value);
    window.requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus());
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex max-w-full flex-wrap gap-1 rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] p-1">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => { buttonRefs.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "min-h-8 shrink-0 whitespace-nowrap rounded-[var(--zc-radius-control)] px-3 py-1.5 text-sm font-medium text-[var(--zc-text-secondary)]",
              "transition-[background,color] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]",
              "hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)]",
              focusVisible,
              selected && "bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)] shadow-[inset_0_-2px_0_var(--zc-primary)]"
            )}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsSwitch({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <SettingsRow id={id} label={label} description={description} className={className}>
      <SettingsSwitchControl id={id} label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </SettingsRow>
  );
}

export function SettingsSwitchControl({
  id,
  label,
  checked,
  onChange,
  disabled = false
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <span className="flex min-h-10 items-center justify-end">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-7 w-12 rounded-full border border-[var(--zc-control-border)] bg-[var(--zc-surface-subtle)] transition-[background,border-color] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]",
          "after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-[var(--zc-surface)] after:shadow-sm after:ring-1 after:ring-[var(--zc-border)] after:transition-transform",
          "peer-checked:border-[var(--zc-primary)] peer-checked:bg-[var(--zc-primary)] peer-checked:after:translate-x-5 peer-checked:after:ring-[var(--zc-primary-pressed)]",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--zc-focus-ring)]",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        )}
      />
    </span>
  );
}

export function SettingsSelect<T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
  disabled = false
}: {
  id: string;
  label: string;
  description?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <SettingsRow id={id} label={label} description={description}>
      <select id={id} className={cn(settingsSelect, "w-full")} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </SettingsRow>
  );
}

export function SettingsTextField({
  id,
  label,
  description,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false
}: {
  id?: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-sm font-medium text-[var(--zc-text-primary)]">{label}</span>
      {description ? <span className="text-xs leading-5 text-[var(--zc-text-tertiary)]">{description}</span> : null}
      <input id={id} className={cn(settingsField, "w-full")} type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function SettingsDisclosure({
  title,
  description,
  children,
  defaultOpen = false
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen || undefined} className="group grid min-w-0 gap-3 border-t border-[var(--zc-divider)] pt-4">
      <summary className={cn("flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-[var(--zc-text-primary)]", focusVisible)}>
        <span className="min-w-0">
          <span className="block">{title}</span>
          {description ? <span className="mt-1 block text-xs font-normal leading-5 text-[var(--zc-text-tertiary)]">{description}</span> : null}
        </span>
        <span aria-hidden="true" className="mt-0.5 text-[var(--zc-text-tertiary)] transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="grid min-w-0 gap-4">{children}</div>
    </details>
  );
}

export function SettingsEmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-28 place-items-center gap-3 rounded-[var(--zc-radius-field)] border border-dashed border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] px-5 py-6 text-center">
      <div className="grid max-w-xl gap-1">
        <strong className="text-sm text-[var(--zc-text-primary)]">{title}</strong>
        {description ? <span className="text-sm leading-6 text-[var(--zc-text-secondary)]">{description}</span> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function SettingsInlineMessage({
  tone = "info",
  children,
  role = "status"
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  role?: "status" | "alert";
}) {
  const toneClass = tone === "danger"
    ? "border-[var(--zc-danger-border)] bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)]"
    : tone === "warning"
      ? "border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)]"
      : tone === "success"
        ? "border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] text-[var(--zc-success-text)]"
        : "border-[var(--zc-info-border)] bg-[var(--zc-info-soft)] text-[var(--zc-info-text)]";
  return <div className={cn("rounded-[var(--zc-radius-field)] border px-3 py-2 text-sm leading-6", toneClass)} role={role}>{children}</div>;
}
