import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FileWorkspaceController } from "../../../fileWorkspace";
import {
  PreviewExperienceController,
  type PreviewExperienceState,
  type PreviewOpenPreparation
} from "./previewExperienceController";

interface PreviewExperienceContextValue {
  readonly controller: PreviewExperienceController;
  readonly state: PreviewExperienceState;
}

const PreviewExperienceContext = createContext<PreviewExperienceContextValue | null>(null);

export function PreviewExperienceProvider({
  workspace,
  prepareOpen,
  children
}: {
  workspace: FileWorkspaceController;
  prepareOpen: PreviewOpenPreparation;
  children: ReactNode;
}) {
  const [controller] = useState(() => new PreviewExperienceController(workspace, prepareOpen));
  const [state, setState] = useState<PreviewExperienceState>(() => controller.getState());
  const pendingDisposeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    controller.setPrepareOpen(prepareOpen);
  }, [controller, prepareOpen]);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, [controller]);

  useEffect(() => {
    if (pendingDisposeRef.current !== null) {
      clearTimeout(pendingDisposeRef.current);
      pendingDisposeRef.current = null;
    }
    return () => {
      // React StrictMode replays effects during development. Deferring final
      // disposal by one task keeps that replay from destroying the workspace-
      // lifetime preview owner while still disposing it after real unmount.
      pendingDisposeRef.current = setTimeout(() => {
        pendingDisposeRef.current = null;
        void controller.dispose();
      }, 0);
    };
  }, [controller]);

  const value = useMemo(() => ({ controller, state }), [controller, state]);
  return <PreviewExperienceContext.Provider value={value}>{children}</PreviewExperienceContext.Provider>;
}

export function usePreviewExperience() {
  const value = useContext(PreviewExperienceContext);
  if (!value) throw new Error("usePreviewExperience must be used within PreviewExperienceProvider.");
  return value;
}
