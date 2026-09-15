import { useEffect } from "react";
import { usePreviewExperience } from "./PreviewExperienceProvider";
import { ZenQuickPreviewSurface } from "./ZenQuickPreviewSurface";

export function ZenPinnedPreview() {
  const { controller, state } = usePreviewExperience();

  useEffect(() => {
    if (!state.visible || state.host !== "pinned") return undefined;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeAndRestoreFocus();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);

    function closeAndRestoreFocus() {
      const target = controller.restoreFocusTarget();
      if (!controller.close("escape")) return;
      window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
  }, [controller, state.host, state.visible]);

  if (!state.visible || state.host !== "pinned") return null;

  const closePinned = () => {
    const target = controller.restoreFocusTarget();
    if (!controller.close("button")) return;
    window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  };

  return (
    <div
      className="zc-quick-preview-backdrop zc-quick-preview-pinned-backdrop"
      data-preview-host="zen-pinned"
      data-preview-shell="true"
      data-preview-state={state.phase}
    >
      <ZenQuickPreviewSurface mode="pinned" onClose={closePinned} />
    </div>
  );
}
