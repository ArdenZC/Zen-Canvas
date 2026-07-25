from __future__ import annotations

from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src/components/CommandModal.tsx"
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected one match, found {count}: {old[:100]}")
    text = text.replace(old, new, 1)


replace_once(
    'import type { FileRecord, GlobalSearchResult, OperationLog } from "../types/domain";',
    'import type { FileRecord, GlobalIndexStatus, GlobalSearchResult, OperationLog } from "../types/domain";',
)
replace_once(
    'import { IconButton, StateBlock, quietText } from "../views/shared/ui";',
    'import { ConfirmDialog, IconButton, StateBlock, quietText } from "../views/shared/ui";',
)
replace_once(
    '  const [commandError, setCommandError] = useState("");\n',
    '  const [commandError, setCommandError] = useState("");\n  const [globalIndexStatus, setGlobalIndexStatus] = useState<GlobalIndexStatus | null>(null);\n  const [pendingManagedEntry, setPendingManagedEntry] = useState<GlobalSearchResult | null>(null);\n  const [isAddingManagedScope, setIsAddingManagedScope] = useState(false);\n',
)
replace_once(
    '  const showGlobalIndexMeta = !isStandaloneCollapsed;\n',
    '  const showGlobalIndexMeta = !isStandaloneCollapsed && Boolean(globalIndexStatus && globalIndexStatus.status !== "ready");\n',
)
replace_once(
    '  useEffect(() => {\n    if (!standalone) return;\n    const focusFrame = requestAnimationFrame(() => inputRef.current?.focus());\n',
    '  useEffect(() => {\n    let disposed = false;\n    void tauriApi.getGlobalIndexStatus()\n      .then((status) => { if (!disposed) setGlobalIndexStatus(status); })\n      .catch(() => undefined);\n    return () => { disposed = true; };\n  }, []);\n\n  useEffect(() => {\n    if (!standalone) return;\n    const focusFrame = requestAnimationFrame(() => inputRef.current?.focus());\n',
)
old_function = '''  async function addGlobalEntryToManagedScope(entry: GlobalSearchResult) {
    if (entry.managed) return;
    try {
      await tauriApi.addManagedScope({
        path: entry.isDirectory ? entry.path : parentPathForManagedScope(entry.path),
        globalEntryId: entry.isDirectory ? entry.id : null,
        enabled: true,
        allowLocalAi: true,
        allowCloudAi: false
      });
      setGlobalResultState((current) => ({
        ...current,
        results: current.results.map((item) => item.id === entry.id ? { ...item, managed: true } : item)
      }));
    } catch (error) {
      const message = readableError(error);
      setCommandError(message);
      onError?.(message);
    }
  }
'''
new_function = '''  function requestGlobalEntryManagedScope(entry: GlobalSearchResult) {
    if (!entry.managed) setPendingManagedEntry(entry);
  }

  async function confirmGlobalEntryManagedScope() {
    const entry = pendingManagedEntry;
    if (!entry || entry.managed || isAddingManagedScope) return;
    setIsAddingManagedScope(true);
    try {
      await tauriApi.addManagedScope({
        path: entry.isDirectory ? entry.path : parentPathForManagedScope(entry.path),
        globalEntryId: entry.isDirectory ? entry.id : null,
        enabled: true,
        allowLocalAi: true,
        allowCloudAi: false
      });
      setGlobalResultState((current) => ({
        ...current,
        results: current.results.map((item) => item.id === entry.id ? { ...item, managed: true } : item)
      }));
      setPendingManagedEntry(null);
    } catch (error) {
      const message = readableError(error);
      setCommandError(message);
      onError?.(message);
    } finally {
      setIsAddingManagedScope(false);
    }
  }
'''
replace_once(old_function, new_function)
replace_once('                onManage={addGlobalEntryToManagedScope}\n', '                onManage={requestGlobalEntryManagedScope}\n')
old_return = '  return standalone ? content : <ModalPortal initialFocusRef={inputRef} restoreFocus={restoreSpotlightFocus} onEscape={onClose}>{content}</ModalPortal>;\n'
new_return = '''  const spotlight = standalone
    ? content
    : <ModalPortal initialFocusRef={inputRef} restoreFocus={restoreSpotlightFocus} onEscape={onClose}>{content}</ModalPortal>;

  return (
    <>
      {spotlight}
      <ConfirmDialog
        open={Boolean(pendingManagedEntry)}
        tone="warning"
        title={t("globalSearchAddManaged")}
        description={t("managedScopesDesc")}
        emphasis={t("managedScopePolicySummary")}
        confirmLabel={t("managedScopeAdd")}
        cancelLabel={t("cancel")}
        isProcessing={isAddingManagedScope}
        onConfirm={() => void confirmGlobalEntryManagedScope()}
        onCancel={() => { if (!isAddingManagedScope) setPendingManagedEntry(null); }}
      />
    </>
  );
'''
replace_once(old_return, new_return)
path.write_text(text, encoding="utf-8")
print("Added Spotlight managed-scope confirmation and degraded-only status strip")
