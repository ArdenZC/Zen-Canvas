import {
  FileWorkspaceController,
  type FileWorkspaceControllerState,
  type WorkspaceMode,
  type WorkspacePresentationState
} from "../../fileWorkspace";
import type {
  LibraryNavigationTarget,
  BrowseNavigationTarget
} from "../../fileWorkspace/workspaceSession";
import type { NavigationTarget, WorkspaceRestoreLocator } from "../../types/fileWorkspace";

const DEFAULT_LIBRARY_TARGET: LibraryNavigationTarget = {
  kind: "library",
  source: "custom",
  key: "legacy_library"
};

interface ModeReturnState {
  presentation: WorkspacePresentationState;
  restoreLocator?: WorkspaceRestoreLocator;
}

export interface FileLibraryExperienceSnapshot {
  mode: WorkspaceMode;
  activeTarget: NavigationTarget | null;
  workspace: FileWorkspaceControllerState;
  canGoBack: boolean;
  canGoForward: boolean;
  hasLibraryTarget: boolean;
  hasBrowseTarget: boolean;
  isDetachedMode: boolean;
}

export type FileLibraryExperienceListener = () => void;

/**
 * W2 shell projection over W1 workspace authority.
 *
 * WorkspaceSession remains the only navigation/history/presentation authority.
 * The small per-mode return cache below is non-authoritative: it can only seed
 * FileWorkspaceController.navigate() with presentation/restore metadata for a
 * target already owned by WorkspaceSession.last*Target.
 */
export class FileLibraryExperienceController {
  readonly workspace: FileWorkspaceController;

  private listeners = new Set<FileLibraryExperienceListener>();
  private detachedMode: WorkspaceMode | null = null;
  private readonly returnState = new Map<WorkspaceMode, ModeReturnState>();
  private snapshotValue: FileLibraryExperienceSnapshot;
  private readonly unsubscribeWorkspace: () => void;

  constructor(workspace = new FileWorkspaceController()) {
    this.workspace = workspace;

    if (this.workspace.session.currentTarget === null) {
      // W2-01 adapts the existing managed Library surface as one neutral target.
      // W2-03 owns semantic Query V2 target mapping (All Files, Recent, tags,
      // saved views, etc.) and must not be pre-claimed by the shell.
      this.workspace.navigate(DEFAULT_LIBRARY_TARGET, {
        presentation: { viewMode: "list" }
      });
    }

    this.rememberCurrentModeState(this.workspace.getState());
    this.snapshotValue = this.buildSnapshot(this.workspace.getState());
    this.unsubscribeWorkspace = this.workspace.subscribe((state) => {
      if (this.detachedMode !== null && state.session.currentTarget?.kind === this.detachedMode) {
        this.detachedMode = null;
      }
      this.rememberCurrentModeState(state);
      this.publish(state);
    });
  }

  getSnapshot = () => this.snapshotValue;

  subscribe = (listener: FileLibraryExperienceListener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  switchMode(mode: WorkspaceMode) {
    const current = this.workspace.getState();
    const projectedMode = this.detachedMode ?? current.session.currentTarget?.kind ?? "library";
    if (mode === projectedMode) return true;

    if (this.detachedMode !== null) {
      const currentTarget = current.session.currentTarget;
      if (currentTarget?.kind === mode) {
        this.detachedMode = null;
        this.publish(current);
        return true;
      }
    }

    this.rememberCurrentModeState(current);
    const target = mode === "library"
      ? current.session.lastLibraryTarget
      : current.session.lastBrowseTarget;

    // First entry to a mode has no authority-bearing target yet. W2-01 may
    // project the shell only; W2-04 owns actual Browse admission.
    if (target === null) {
      this.detachedMode = mode;
      this.publish(current);
      return true;
    }

    const options = this.navigationOptionsFor(mode, target);
    if (mode === "browse" && options === null) return false;

    this.detachedMode = null;
    const changed = this.workspace.navigate(target, options ?? {});
    if (!changed) {
      this.publish(this.workspace.getState());
      return false;
    }
    return true;
  }

  async goBack() {
    if (this.detachedMode !== null) return false;
    const before = this.workspace.getState();
    if (before.session.historyIndex <= 0) return false;
    this.rememberCurrentModeState(before);
    await this.workspace.back();
    return this.workspace.getState().session.historyIndex !== before.session.historyIndex;
  }

  async goForward() {
    if (this.detachedMode !== null) return false;
    const before = this.workspace.getState();
    if (before.session.historyIndex < 0
      || before.session.historyIndex >= before.session.history.length - 1) {
      return false;
    }
    this.rememberCurrentModeState(before);
    await this.workspace.forward();
    return this.workspace.getState().session.historyIndex !== before.session.historyIndex;
  }

  async dispose() {
    this.unsubscribeWorkspace();
    this.listeners.clear();
    await this.workspace.dispose();
  }

  private navigationOptionsFor(
    mode: WorkspaceMode,
    target: LibraryNavigationTarget | BrowseNavigationTarget
  ) {
    const remembered = this.returnState.get(mode);
    if (mode === "library") {
      return remembered === undefined
        ? {}
        : { presentation: remembered.presentation };
    }

    const locator = remembered?.restoreLocator;
    if (target.kind !== "browse" || locator?.kind !== "browse") return null;
    return {
      restoreLocator: locator,
      presentation: remembered?.presentation
    };
  }

  private rememberCurrentModeState(state: FileWorkspaceControllerState) {
    const target = state.session.currentTarget;
    if (target === null) return;

    const presentation: WorkspacePresentationState = {
      ...(state.session.presentation.viewMode === undefined
        ? {}
        : { viewMode: state.session.presentation.viewMode }),
      ...(state.session.presentation.scrollAnchor === undefined
        ? {}
        : { scrollAnchor: state.session.presentation.scrollAnchor })
    };

    if (target.kind === "browse") {
      const locator = this.workspace.session.serializeRestoreLocator();
      if (locator?.kind !== "browse") return;
      this.returnState.set("browse", { presentation, restoreLocator: locator });
      return;
    }

    this.returnState.set("library", { presentation });
  }

  private publish(state: FileWorkspaceControllerState) {
    this.snapshotValue = this.buildSnapshot(state);
    for (const listener of this.listeners) listener();
  }

  private buildSnapshot(state: FileWorkspaceControllerState): FileLibraryExperienceSnapshot {
    const currentTarget = state.session.currentTarget;
    const mode = this.detachedMode ?? currentTarget?.kind ?? "library";
    const historyIndex = state.session.historyIndex;
    const canUseHistory = this.detachedMode === null;

    return {
      mode,
      activeTarget: currentTarget?.kind === mode ? currentTarget : null,
      workspace: state,
      canGoBack: canUseHistory && historyIndex > 0,
      canGoForward: canUseHistory
        && historyIndex >= 0
        && historyIndex < state.session.history.length - 1,
      hasLibraryTarget: state.session.lastLibraryTarget !== null,
      hasBrowseTarget: state.session.lastBrowseTarget !== null,
      isDetachedMode: this.detachedMode !== null
    };
  }
}

export function createFileLibraryExperienceController(
  workspace = new FileWorkspaceController()
) {
  return new FileLibraryExperienceController(workspace);
}
