import type {
  BrowseOpenRequest,
  BrowseOpenResponse,
  NavigationTarget,
  WorkspaceRestoreLocator
} from "../../types/fileWorkspace";
import {
  FileWorkspaceController,
  WorkspaceSession,
  type FileWorkspaceControllerState
} from "../../fileWorkspace";

export type FileLibraryMode = "library" | "browse";

/**
 * Internal W2 migration target only. The user-facing shell always localizes
 * Library from the product label and must never display this key.
 */
export const LEGACY_LIBRARY_MIGRATION_TARGET: NavigationTarget = {
  kind: "library",
  source: "custom",
  key: "legacy_library"
};

export interface FileLibraryExperienceState {
  mode: FileLibraryMode;
  detachedBrowse: boolean;
  workspace: FileWorkspaceControllerState;
}

export class FileLibraryExperienceController {
  readonly workspace: FileWorkspaceController;

  private readonly listeners = new Set<(state: FileLibraryExperienceState) => void>();
  private readonly unsubscribeWorkspace: () => boolean;
  private modeValue: FileLibraryMode = "library";
  private detachedBrowseValue = false;
  private disposedValue = false;
  private stateValue: FileLibraryExperienceState;

  constructor(workspace = createDefaultWorkspaceController()) {
    this.workspace = workspace;
    this.stateValue = this.composeState(workspace.getState());
    this.unsubscribeWorkspace = workspace.subscribe((state) => this.syncFromWorkspace(state));
  }

  getState() {
    return this.stateValue;
  }

  subscribe(listener: (state: FileLibraryExperienceState) => void) {
    this.listeners.add(listener);
    listener(this.stateValue);
    return () => this.listeners.delete(listener);
  }

  navigate(target: NavigationTarget, options?: Parameters<FileWorkspaceController["navigate"]>[1]) {
    if (this.disposedValue) return false;
    const changed = this.workspace.navigate(target, options);
    this.syncFromWorkspace();
    return changed;
  }

  async openBrowse(request: BrowseOpenRequest): Promise<BrowseOpenResponse | null> {
    if (this.disposedValue) return null;
    const response = await this.workspace.openBrowse(request);
    if (response !== null) {
      this.modeValue = "browse";
      this.detachedBrowseValue = false;
    }
    this.syncFromWorkspace();
    return response;
  }

  async restoreBrowse(locator: WorkspaceRestoreLocator): Promise<BrowseOpenResponse | null> {
    if (this.disposedValue) return null;
    const response = await this.workspace.restoreBrowse(locator);
    if (response !== null) {
      this.modeValue = "browse";
      this.detachedBrowseValue = false;
    }
    this.syncFromWorkspace();
    return response;
  }

  /**
   * First-entry Browse is intentionally only a projection change. Once W1 has
   * a remembered Browse target, the controller owns the real mode transition
   * and its disposable-work cleanup chronology.
   */
  async switchMode(mode: FileLibraryMode) {
    if (this.disposedValue || this.workspace.getState().suspended) return false;

    const workspaceState = this.workspace.getState();
    const currentTarget = workspaceState.session.currentTarget;
    if (currentTarget?.kind === mode && !this.detachedBrowseValue) {
      this.modeValue = mode;
      this.syncFromWorkspace(workspaceState);
      return true;
    }

    if (mode === "browse" && workspaceState.session.lastBrowseTarget === null) {
      this.modeValue = "browse";
      this.detachedBrowseValue = true;
      this.publishProjection(workspaceState);
      return true;
    }

    if (mode === "library" && this.detachedBrowseValue) {
      this.modeValue = "library";
      this.detachedBrowseValue = false;
      this.publishProjection(workspaceState);
      return true;
    }

    const switched = await this.workspace.switchMode(mode);
    if (!switched) return false;
    this.modeValue = mode;
    this.detachedBrowseValue = false;
    this.syncFromWorkspace();
    return true;
  }

  async back() {
    if (this.disposedValue || this.workspace.getState().suspended) return false;
    const before = this.workspace.getState().session.historyIndex;
    await this.workspace.back();
    const after = this.workspace.getState().session.historyIndex;
    this.syncFromWorkspace();
    return before !== after;
  }

  async forward() {
    if (this.disposedValue || this.workspace.getState().suspended) return false;
    const before = this.workspace.getState().session.historyIndex;
    await this.workspace.forward();
    const after = this.workspace.getState().session.historyIndex;
    this.syncFromWorkspace();
    return before !== after;
  }

  async suspend() {
    if (this.disposedValue) return false;
    const suspended = await this.workspace.suspend();
    this.syncFromWorkspace();
    return suspended;
  }

  async resume() {
    if (this.disposedValue) return false;
    const resumed = await this.workspace.resume();
    this.syncFromWorkspace();
    return resumed;
  }

  async dispose() {
    if (this.disposedValue) return false;
    this.disposedValue = true;
    this.unsubscribeWorkspace();
    await this.workspace.dispose();
    this.syncFromWorkspace();
    return true;
  }

  private composeState(workspace: FileWorkspaceControllerState): FileLibraryExperienceState {
    return {
      mode: this.modeValue,
      detachedBrowse: this.detachedBrowseValue,
      workspace
    };
  }

  private syncFromWorkspace(workspace = this.workspace.getState()) {
    const currentTarget = workspace.session.currentTarget;
    if (currentTarget !== null) {
      this.modeValue = currentTarget.kind;
      this.detachedBrowseValue = false;
    }
    this.stateValue = this.composeState(workspace);
    this.emit();
  }

  private publishProjection(workspace = this.workspace.getState()) {
    this.stateValue = this.composeState(workspace);
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener(this.stateValue);
  }
}

function createDefaultWorkspaceController() {
  return new FileWorkspaceController(
    undefined,
    new WorkspaceSession({ initialTarget: LEGACY_LIBRARY_MIGRATION_TARGET })
  );
}
