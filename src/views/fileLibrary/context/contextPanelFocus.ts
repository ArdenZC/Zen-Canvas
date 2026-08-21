export function scheduleContextToggleFocusRestore() {
  requestAnimationFrame(() => {
    const toggle = document.querySelector<HTMLElement>("[data-file-library-context-toggle]");
    toggle?.focus();
    requestAnimationFrame(() => {
      if (document.activeElement !== toggle) toggle?.focus();
      window.setTimeout(() => toggle?.focus(), 0);
    });
  });
}
