import { useId, useRef, useState } from "react";
import type { ScanRootDto } from "../../api/types";
import { ModalPortal } from "../../components/modal/ModalPortal";
import { cloneFileQuerySpec, defaultFileLibraryQuerySpec, useFileLibraryQueryStore } from "../../store/useFileLibraryV2Store";
import type { AutomationIntent, AutomationIntentDraft, AutomationScopeQuery } from "../../types/automation";
import type { Translator } from "../../types/ui";
import { inputSurface } from "../../utils/tw";
import { Button, panelSurface } from "../shared/ui";

export function AutomationIntentEditor({ intent, roots, t, busy, onSave, onClose }: {
  intent?: AutomationIntent; roots: ScanRootDto[]; t: Translator; busy: boolean;
  onSave: (draft: AutomationIntentDraft) => Promise<boolean>; onClose: () => void;
}) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(intent?.title ?? "");
  const [enabled, setEnabled] = useState(intent?.enabled ?? true);
  const [query, setQuery] = useState<AutomationScopeQuery>(() => cloneFileQuerySpec(intent?.scopeQuery ?? defaultFileLibraryQuerySpec) as AutomationScopeQuery);
  const [invalidScope, setInvalidScope] = useState(false);
  const copyQuery = () => {
    const current = useFileLibraryQueryStore.getState().spec;
    if (current.scope.kind === "current_scan") { setInvalidScope(true); return; }
    setQuery(cloneFileQuerySpec(current) as AutomationScopeQuery); setInvalidScope(false);
  };
  const canSave = title.trim().length > 0 && title.trim().length <= 120 && (query.scope.kind !== "roots" || query.scope.scanRootIds.length > 0);
  return <ModalPortal initialFocusRef={titleRef} onEscape={() => { if (!busy) onClose(); }}>
    <div className="fixed inset-0 flex items-center justify-center bg-black/35 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} className={`${panelSurface} max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 space-y-4`} onSubmit={(event) => {
        event.preventDefault();
        if (canSave && !busy) void onSave({ title: title.trim(), workflowKind: "organize_plan", scopeQuery: query, trigger: { version: 1, kind: "manual" }, policy: { version: 1, review: "required", autoExecute: false }, enabled }).then((saved) => { if (saved) onClose(); });
      }}>
        <h2 id={`${id}-heading`} className="text-xl font-semibold">{t(intent ? "automationEditIntent" : "automationCreateIntent")}</h2>
        <label className="block space-y-1">{t("automationIntentTitle")}<input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required disabled={busy} className={`${inputSurface} block w-full`} /></label>
        <label className="block space-y-1">{t("automationQueryText")}<input value={query.text ?? ""} disabled={busy} onChange={(event) => setQuery({ ...query, text: event.target.value || null })} className={`${inputSurface} block w-full`} /></label>
        <Button type="button" disabled={busy} onClick={copyQuery}>{t("automationUseLibraryFilters")}</Button>
        <p className="text-sm opacity-70">{t("automationFilterHelp")}</p>
        {invalidScope && <p role="alert">{t("automationTemporaryScope")}</p>}
        <fieldset disabled={busy} className="space-y-2"><legend className="font-medium">{t("automationIntentScope")}</legend>
          <label className="flex gap-2"><input type="radio" name={`${id}-scope`} checked={query.scope.kind === "all_enabled_roots"} onChange={() => setQuery({ ...query, scope: { kind: "all_enabled_roots" } })} />{t("automationAllRoots")}</label>
          <label className="flex gap-2"><input type="radio" name={`${id}-scope`} checked={query.scope.kind === "roots"} onChange={() => setQuery({ ...query, scope: { kind: "roots", scanRootIds: [] } })} />{t("automationSelectedRoots")}</label>
          {query.scope.kind === "roots" && <div className="pl-5 space-y-2">{roots.map((root) => {
            const selected = query.scope.kind === "roots" && query.scope.scanRootIds.includes(root.id);
            return <label key={root.id} className="flex gap-2 break-all"><input type="checkbox" checked={selected} disabled={!root.enabled || root.healthStatus !== "healthy"} onChange={(event) => {
              const previous = query.scope.kind === "roots" ? query.scope.scanRootIds : [];
              setQuery({ ...query, scope: { kind: "roots", scanRootIds: event.target.checked ? [...previous, root.id] : previous.filter((rootId) => rootId !== root.id) } });
            }} />{root.displayName}</label>;
          })}{query.scope.scanRootIds.filter((rootId) => !roots.some((root) => root.id === rootId)).map((rootId) => <p key={rootId}>{t("automationUnavailableRoot")}</p>)}{roots.length === 0 && <p>{t("automationNoRoots")}</p>}</div>}
        </fieldset>
        <label className="flex gap-2"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} />{t("automationIntentEnabled")}</label>
        <p className="text-sm opacity-70">{t("automationFixedPolicy")}</p>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" disabled={busy} onClick={onClose}>{t("cancel")}</Button><Button type="submit" variant="primary" disabled={!canSave || busy}>{t(busy ? "automationIntentSaving" : "save")}</Button></div>
      </form>
    </div>
  </ModalPortal>;
}
