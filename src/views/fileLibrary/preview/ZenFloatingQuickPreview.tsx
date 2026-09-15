import { useRef, type KeyboardEvent } from "react";
import { ModalPortal } from "../../../components/modal/ModalPortal";
import { usePreviewExperience } from "./PreviewExperienceProvider";
import { handleFloatingPreviewSpace } from "./previewExperienceController";
import { ZenQuickPreviewSurface } from "./ZenQuickPreviewSurface";
import "./zenFloatingQuickPreview.css";

export function ZenFloatingQuickPreview() {
  const { controller, state } = usePreviewExperience();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  if (!state.visible || state.host !== "floating") return null;

  return (
    <ModalPortal
      modalId="file-library-floating-preview"
      onEscape={() => controller.close("escape")}
      initialFocusRef={closeRef}
      restoreFocus={() => controller.restoreFocusTarget()}
    >
      <div
        className="zc-quick-preview-backdrop"
        data-preview-host="zen-floating"
        data-preview-shell="true"
        data-preview-state={state.phase}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) controller.close("button");
        }}
        onKeyDown={(event) => handleHostKeyDown(event, controller.close.bind(controller))}
      >
        <ZenQuickPreviewSurface mode="floating" closeRef={closeRef} />
      </div>
    </ModalPortal>
  );
}

function handleHostKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  close: () => boolean
) {
  handleFloatingPreviewSpace({
    key: event.key,
    altKey: event.altKey,
    defaultPrevented: event.defaultPrevented,
    isComposing: event.nativeEvent.isComposing,
    repeat: event.repeat,
    target: event.target,
    preventDefault: () => event.preventDefault()
  }, close);
}
