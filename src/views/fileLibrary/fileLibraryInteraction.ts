/**
 * Returns true when a workspace-level shortcut must yield to the control that
 * currently owns the keyboard event. The File Library local-search shortcut
 * is intentionally narrower than a document-wide browser shortcut.
 */
export function isFileLibraryShortcutExcludedTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement
    ? target
    : target instanceof SVGElement
      ? target.parentElement
      : null;
  if (!element) return false;
  return Boolean(element.closest(
    "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='dialog'], [aria-modal='true']"
  ));
}

export function isFileLibraryFocusTarget(target: HTMLElement | null) {
  return Boolean(target?.isConnected
    && target !== document.body
    && target !== document.documentElement
    && !target.matches(":disabled, [disabled], [hidden], [aria-disabled='true']")
    && (target.tabIndex >= 0 || target.matches("button, input, select, textarea, a[href], [contenteditable='true']")));
}
