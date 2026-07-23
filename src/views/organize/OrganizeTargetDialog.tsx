import { useEffect, useId, useRef, useState } from "react";
import type { Translator } from "../../types/ui";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import { normalizeProposedFileNameExtension } from "../../utils/fileNaming";
import { buttonSecondary, cn, floatingSurface, glassButtonPrimary, inputSurface } from "../../utils/tw";
import { validateOrganizeFileName, type OrganizeNameError, type OrganizeSuggestion } from "./organizeModel";
import { ModalPortal } from "../../components/modal/ModalPortal";

export function OrganizeTargetDialog({ suggestion, t, onSave, onClose }: { suggestion: OrganizeSuggestion | null; t: Translator; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!suggestion) return;
    setName(suggestion.editedName || suggestion.preview?.new_name || suggestion.file.name);
  }, [suggestion]);

  if (!suggestion) return null;
  const syntaxError = validateOrganizeFileName(name);
  const extensionNormalization = normalizeProposedFileNameExtension(suggestion.file.name, name);
  const error: OrganizeNameError | null = syntaxError ?? extensionNormalization.error;
  const errorMessage = error ? t(error === "empty" ? "organizeNameErrorEmpty" : error === "reserved" ? "organizeNameErrorReserved" : error === "extension" ? "organizeNameErrorExtension" : "organizeNameErrorUnsafe") : "";
  const normalizedName = extensionNormalization.error === null ? extensionNormalization.name : name.trim();
  return (
    <ModalPortal initialFocusRef={inputRef} onEscape={() => onCloseRef.current()}>
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
      <div className={cn(floatingSurface, "grid w-full max-w-lg gap-4 p-5")} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div>
          <h2 id={titleId} className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("organizeTargetDialogTitle")}</h2>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--zc-text-secondary)]">{t("organizeTargetDialogDesc")}</p>
        </div>
        <dl className="grid gap-3 text-sm">
          <div><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("organizeCurrentPath")}</dt><dd className="mt-1 break-words text-[var(--zc-text-primary)]">{compactPath(formatDisplayPath(suggestion.file.path), 92)}</dd></div>
          <div><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("organizeSuggestedTarget")}</dt><dd className="mt-1 break-words text-[var(--zc-text-primary)]">{compactPath(formatDisplayPath(suggestion.preview?.target_path || suggestion.file.suggested_target_path), 92)}</dd></div>
        </dl>
        <label className="grid gap-1.5 text-sm font-medium text-[var(--zc-text-secondary)]">
          {t("organizeNewFileName")}
          <input ref={inputRef} className={cn(inputSurface, "w-full")} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${descriptionId}-error` : undefined} onBlur={() => { if (!syntaxError && extensionNormalization.error === null && extensionNormalization.name !== name) setName(extensionNormalization.name); }} onKeyDown={(event) => { if (event.key === "Enter" && !error) { event.preventDefault(); onSave(normalizedName); } }} />
        </label>
        {error ? <p id={`${descriptionId}-error`} className="text-sm text-[var(--zc-danger-text)]" role="alert">{errorMessage}</p> : <p className="text-xs text-[var(--zc-text-tertiary)]">{t("organizeNameOnly")}</p>}
        <div className="flex justify-end gap-2">
          <button className={buttonSecondary} onClick={onClose}>{t("cancel")}</button>
          <button className={glassButtonPrimary} disabled={Boolean(error)} onClick={() => onSave(normalizedName)}>{t("save")}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
