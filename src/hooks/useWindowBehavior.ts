import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { CloseBehavior } from "../types/domain";

export function useWindowBehavior() {
  const [isCloseChoiceOpen, setIsCloseChoiceOpen] = useState(false);
  const [closeBehavior, setCloseBehaviorState] = useState<CloseBehavior>(() => {
    const saved = window.localStorage.getItem("zc-close-behavior");
    return saved === "minimize" || saved === "quit" || saved === "ask" ? saved : "ask";
  });
  const closeBehaviorRef = useRef(closeBehavior);

  useEffect(() => {
    closeBehaviorRef.current = closeBehavior;
  }, [closeBehavior]);

  const setCloseBehavior = useCallback(async (next: CloseBehavior) => {
    window.localStorage.setItem("zc-close-behavior", next);
    setCloseBehaviorState(next);
  }, []);

  const requestClose = useCallback(() => {
    const behavior = closeBehaviorRef.current;
    if (behavior === "ask") {
      setIsCloseChoiceOpen(true);
      return;
    }
    if (behavior === "quit") getCurrentWindow().close();
    setIsCloseChoiceOpen(false);
  }, []);

  const handleWindowAction = useCallback(
    async (action: "minimize" | "maximize" | "close") => {
      const win = getCurrentWindow();
      if (action === "minimize") {
        await win.minimize();
      } else if (action === "maximize") {
        const isMax = await win.isMaximized();
        if (isMax) {
          await win.unmaximize();
        } else {
          await win.maximize();
        }
      } else {
        requestClose();
      }
    },
    [requestClose]
  );

  const resolveCloseChoice = useCallback(
    async (action: "minimize" | "quit", remember: boolean) => {
      if (remember) await setCloseBehavior(action);
      setIsCloseChoiceOpen(false);
      if (action === "quit") getCurrentWindow().close();
    },
    [setCloseBehavior]
  );

  const onCancelCloseChoice = useCallback(() => {
    setIsCloseChoiceOpen(false);
  }, []);

  return {
    closeBehavior,
    setCloseBehavior,
    isCloseChoiceOpen,
    handleWindowAction,
    resolveCloseChoice,
    onCancelCloseChoice
  };
}
