export type FocusTarget = { focus: () => void };

export function cycleDialogFocus(
  event: { key: string; shiftKey: boolean; preventDefault: () => void },
  focusable: FocusTarget[],
  activeElement: FocusTarget | null
) {
  if (event.key !== "Tab" || focusable.length === 0) return false;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function restoreDialogFocus(target: FocusTarget | null | undefined) {
  target?.focus();
}
