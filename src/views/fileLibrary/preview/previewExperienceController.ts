import type {
  ContentReadEligibility,
  PreviewSourceRef,
  PreviewSessionState,
  PreviewSnapshot
} from "../../../types/fileWorkspace";
import type { FileWorkspaceController } from "../../../fileWorkspace";
import type { PreviewSourceProjection } from "./previewSource";
import {
  previewSiblingNavigationState,
  type PreviewSiblingDirection,
  type PreviewSiblingNavigationProjection,
  type PreviewSiblingNavigationState
} from "./previewSiblingNavigation";

export type PreviewExperiencePhase =
  | "closed"
  | "resolving"
  | "loading"
  | "metadata_fallback"
  | "no_source"
  | "source_unavailable"
  | "materialization_required"
  | "permission_denied"
  | "identity_changed"
  | "cancelled"
  | "unsupported_representation"
  | "error";

export type PreviewExperienceHost = "floating" | "pinned";

export interface PreviewPinnedHandoff {
  readonly fromHost: "zen_floating";
  readonly toHost: "zen_pinned";
  readonly previewId: string;
  readonly source: Extract<PreviewSourceRef, { kind: "managed" | "ephemeral" }>;
  readonly sourceKey: string;
  readonly frontendEpoch: number;
}

export type PreviewPinnedHandoffHandler = (handoff: PreviewPinnedHandoff) => boolean;

export interface PreviewExperienceState {
  readonly visible: boolean;
  readonly host: PreviewExperienceHost | null;
  readonly frontendEpoch: number;
  readonly source: PreviewSourceProjection | null;
  readonly previewId: string | null;
  readonly snapshot: PreviewSnapshot | null;
  readonly phase: PreviewExperiencePhase;
  readonly navigation: PreviewSiblingNavigationState | null;
  readonly navigationBusy: boolean;
}

export type PreviewOpenPreparation = () => void;

export interface PreviewSpaceEvent {
  readonly altKey: boolean;
  readonly defaultPrevented?: boolean;
  readonly isComposing?: boolean;
  readonly repeat?: boolean;
  readonly target: EventTarget | null;
}

const CLOSED_STATE: PreviewExperienceState = {
  visible: false,
  host: null,
  frontendEpoch: 0,
  source: null,
  previewId: null,
  snapshot: null,
  phase: "closed",
  navigation: null,
  navigationBusy: false
};

/**
 * The sole W3-02 renderer owner. It owns only disposable UI/epoch state and
 * delegates Preview lifecycle to FileWorkspaceController, which remains the
 * backend handle owner.
 */
export class PreviewExperienceController {
  private readonly workspace: FileWorkspaceController;
  private readonly listeners = new Set<(state: PreviewExperienceState) => void>();
  private stateValue: PreviewExperienceState = CLOSED_STATE;
  private prepareOpenValue: PreviewOpenPreparation;
  private pinHandoffValue: PreviewPinnedHandoffHandler;
  private originFocus: HTMLElement | null = null;
  private disposedValue = false;
  private nextRequest = 0;
  private siblingNavigationValue: PreviewSiblingNavigationProjection | null = null;
  private navigationBusyValue = false;

  constructor(
    workspace: FileWorkspaceController,
    prepareOpen: PreviewOpenPreparation = () => undefined,
    onPinHandoff: PreviewPinnedHandoffHandler = () => true
  ) {
    this.workspace = workspace;
    this.prepareOpenValue = prepareOpen;
    this.pinHandoffValue = onPinHandoff;
  }

  getState() {
    return this.stateWithNavigation();
  }

  subscribe(listener: (state: PreviewExperienceState) => void) {
    this.listeners.add(listener);
    listener(this.stateWithNavigation());
    return () => this.listeners.delete(listener);
  }

  setPrepareOpen(prepareOpen: PreviewOpenPreparation) {
    this.prepareOpenValue = prepareOpen;
  }

  setPinHandoff(onPinHandoff: PreviewPinnedHandoffHandler) {
    this.pinHandoffValue = onPinHandoff;
  }

  /** Returns false when the event is guarded and therefore must not be consumed. */
  handleSpace(
    source: PreviewSourceProjection | null,
    trigger: HTMLElement | null,
    event?: PreviewSpaceEvent
  ) {
    if (event !== undefined && !isPreviewSpaceEligible(event)) return false;
    if (this.stateValue.visible) {
      if (this.stateValue.host === "pinned") return false;
      this.close("space");
      return true;
    }
    if (source === null) return false;
    return this.open(source, trigger);
  }

  open(source: PreviewSourceProjection | null, trigger: HTMLElement | null) {
    if (this.disposedValue || source === null) return false;
    if (this.stateValue.visible) {
      this.publishSource(source);
      return true;
    }

    this.prepareOpenValue();
    this.originFocus = isRestorableFocusTarget(trigger) ? trigger : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const epoch = this.stateValue.frontendEpoch + 1;
    this.stateValue = {
      visible: true,
      host: "floating",
      frontendEpoch: epoch,
      source,
      previewId: null,
      snapshot: null,
      phase: "resolving",
      navigation: null,
      navigationBusy: false
    };
    this.emit();
    void this.createAndStart(epoch, source);
    return true;
  }

  /** Reconciles the current loaded source without changing host identity. */
  observeSource(source: PreviewSourceProjection | null) {
    if (!this.stateValue.visible || sameSource(this.stateValue.source, source)) return;
    this.publishSource(source);
  }

  setSiblingNavigation(navigation: PreviewSiblingNavigationProjection | null) {
    this.siblingNavigationValue = navigation;
    this.emit();
  }

  async moveSibling(direction: PreviewSiblingDirection) {
    const navigation = this.siblingNavigationValue;
    const state = this.stateWithNavigation();
    if (navigation === null || state.navigation === null || this.navigationBusyValue) return false;
    const available = direction === "previous"
      ? state.navigation.previousAvailable
      : state.navigation.nextAvailable;
    if (!available) return false;

    this.navigationBusyValue = true;
    this.emit();
    try {
      return await navigation.move(direction);
    } finally {
      this.navigationBusyValue = false;
      this.emit();
    }
  }

  pin() {
    if (this.disposedValue
      || !this.stateValue.visible
      || this.stateValue.host !== "floating"
      || this.stateValue.previewId === null
      || this.stateValue.source === null) {
      return false;
    }

    const handoff: PreviewPinnedHandoff = {
      fromHost: "zen_floating",
      toHost: "zen_pinned",
      previewId: this.stateValue.previewId,
      source: this.stateValue.source.previewSource,
      sourceKey: this.stateValue.source.key,
      frontendEpoch: this.stateValue.frontendEpoch
    };
    let accepted = false;
    try {
      accepted = this.pinHandoffValue(handoff);
    } catch {
      accepted = false;
    }
    if (!accepted) return false;

    this.stateValue = { ...this.stateValue, host: "pinned" };
    this.emit();
    return true;
  }

  close(_reason: "space" | "escape" | "button" | "source_unavailable" | "unpin" | "dispose" = "button") {
    if (!this.stateValue.visible) return false;
    const previewId = this.stateValue.previewId;
    this.siblingNavigationValue = null;
    this.stateValue = {
      ...CLOSED_STATE,
      frontendEpoch: this.stateValue.frontendEpoch + 1
    };
    this.emit();
    if (previewId !== null) void this.workspace.disposePreview(previewId);
    return true;
  }

  restoreFocusTarget() {
    if (isRestorableFocusTarget(this.originFocus)) return this.originFocus;
    return document.querySelector<HTMLElement>(
      '[data-shared-file-list="true"], [data-shared-file-grid="true"]'
    );
  }

  async settle() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async dispose() {
    if (this.disposedValue) return false;
    this.disposedValue = true;
    this.close("dispose");
    this.listeners.clear();
    return true;
  }

  private publishSource(source: PreviewSourceProjection | null) {
    const previousPreviewId = this.stateValue.previewId;
    const epoch = this.stateValue.frontendEpoch + 1;
    this.stateValue = {
      ...this.stateValue,
      frontendEpoch: epoch,
      source,
      previewId: source === null ? null : previousPreviewId,
      snapshot: null,
      phase: source === null ? "no_source" : "resolving"
    };
    this.emit();
    if (source === null) {
      if (previousPreviewId !== null) void this.workspace.disposePreview(previousPreviewId);
      return;
    }
    if (previousPreviewId === null) {
      void this.createAndStart(epoch, source);
      return;
    }
    void this.switchAndStart(epoch, previousPreviewId, source);
  }

  private async createAndStart(epoch: number, source: PreviewSourceProjection) {
    const requestId = this.requestId(epoch);
    try {
      const created = await this.workspace.createPreview({
        requestId,
        source: source.previewSource,
        hostKind: "zen_floating"
      });
      if (created === null) return;
      if (!this.isCurrent(epoch, source)) {
        await this.workspace.disposePreview(created.previewId);
        return;
      }
      this.publishSnapshot(epoch, source, created);
      const started = await this.workspace.startPreview(created.previewId);
      if (started !== null && this.isCurrent(epoch, source)) this.publishSnapshot(epoch, source, started);
    } catch {
      if (this.isCurrent(epoch, source)) this.publishTerminal(epoch, source, "error", null);
    }
  }

  private async switchAndStart(epoch: number, previewId: string, source: PreviewSourceProjection) {
    const requestId = this.requestId(epoch);
    try {
      const switched = await this.workspace.switchPreviewSource({
        previewId,
        requestId,
        source: source.previewSource
      });
      if (switched === null || !this.isCurrent(epoch, source)) return;
      this.publishSnapshot(epoch, source, switched);
      const started = await this.workspace.startPreview(previewId);
      if (started !== null && this.isCurrent(epoch, source)) this.publishSnapshot(epoch, source, started);
    } catch {
      if (this.isCurrent(epoch, source)) this.publishTerminal(epoch, source, "error", null);
    }
  }

  private publishSnapshot(epoch: number, source: PreviewSourceProjection, snapshot: PreviewSnapshot) {
    if (!this.isCurrent(epoch, source)) return;
    const phase = phaseForSnapshot(snapshot);
    this.stateValue = {
      ...this.stateValue,
      previewId: snapshot.previewId,
      snapshot,
      phase
    };
    this.emit();
  }

  private publishTerminal(
    epoch: number,
    source: PreviewSourceProjection,
    phase: PreviewExperiencePhase,
    snapshot: PreviewSnapshot | null
  ) {
    if (!this.isCurrent(epoch, source)) return;
    this.stateValue = { ...this.stateValue, snapshot, phase };
    this.emit();
  }

  private isCurrent(epoch: number, source: PreviewSourceProjection) {
    return this.stateValue.visible
      && this.stateValue.frontendEpoch === epoch
      && sameSource(this.stateValue.source, source);
  }

  private requestId(epoch: number) {
    this.nextRequest += 1;
    return `w3-02-preview-${epoch}-${this.nextRequest}`;
  }

  private emit() {
    const state = this.stateWithNavigation();
    for (const listener of this.listeners) listener(state);
  }

  private stateWithNavigation(): PreviewExperienceState {
    return {
      ...this.stateValue,
      navigation: previewSiblingNavigationState(this.siblingNavigationValue, this.stateValue.source),
      navigationBusy: this.navigationBusyValue
    };
  }
}

export function isPreviewSpaceEligible(
  event: PreviewSpaceEvent
) {
  if (event.defaultPrevented === true || event.isComposing === true || event.altKey || event.repeat === true) return false;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target === null) return true;
  return target.closest(
    "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='menu'], [role='dialog'], [aria-modal='true']"
  ) === null;
}

function sameSource(left: PreviewSourceProjection | null, right: PreviewSourceProjection | null) {
  return left?.key === right?.key;
}

function isRestorableFocusTarget(target: HTMLElement | null): target is HTMLElement {
  return Boolean(target?.isConnected
    && target !== document.body
    && target !== document.documentElement
    && !target.hasAttribute("disabled")
    && (target.tabIndex >= 0 || target.matches("button, input, select, textarea, a[href], [contenteditable='true']")));
}

function phaseForSnapshot(snapshot: PreviewSnapshot): PreviewExperiencePhase {
  if (snapshot.state === "idle" || snapshot.state === "resolving" || snapshot.state === "preparing") return "resolving";
  if (snapshot.state === "loading") return "loading";
  if (snapshot.state === "cancelled") return "cancelled";
  if (snapshot.state === "failed" || snapshot.state === "disposed") return "error";

  const representation = snapshot.representation?.representation;
  if (representation === undefined) return "metadata_fallback";
  if (representation.family !== "metadata") return "unsupported_representation";
  return phaseForEligibility(representation.metadata.readEligibility);
}

function phaseForEligibility(eligibility: ContentReadEligibility): PreviewExperiencePhase {
  switch (eligibility) {
    case "materialization_required":
    case "downloading":
    case "metadata_only":
      return eligibility === "materialization_required" || eligibility === "downloading"
        ? "materialization_required"
        : "metadata_fallback";
    case "permission_required":
      return "permission_denied";
    case "identity_changed":
      return "identity_changed";
    case "source_unavailable":
    case "source_not_supported":
    case "package_unsupported":
    case "symlink":
    case "availability_unknown":
      return "source_unavailable";
    case "eligible":
      return "metadata_fallback";
    default:
      return "error";
  }
}
