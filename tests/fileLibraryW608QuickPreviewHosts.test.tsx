// @vitest-environment happy-dom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type {
  PreviewAssetArtifact,
  PreviewCapabilities,
  PreviewHostKind,
  PreviewSnapshot
} from "../src/types/fileWorkspace";
import type { Translator } from "../src/types/ui";
import type { PreviewExperienceState } from "../src/views/fileLibrary/preview/previewExperienceController";
import type { PreviewSourceProjection } from "../src/views/fileLibrary/preview/previewSource";

const hostHarness = vi.hoisted(() => ({
  value: null as {
    controller: Record<string, unknown>;
    state: PreviewExperienceState;
  } | null,
  t: ((key: string) => key) as Translator
}));

vi.mock("../src/contexts/AppContexts", () => ({
  useI18nContext: () => ({ language: "en", t: hostHarness.t })
}));

vi.mock("../src/views/fileLibrary/preview/PreviewExperienceProvider", () => ({
  usePreviewExperience: () => hostHarness.value
}));

vi.mock("../src/components/modal/ModalPortal", () => ({
  ModalPortal: ({ children }: { children: ReactNode }) => children
}));

import { ZenFloatingQuickPreview } from "../src/views/fileLibrary/preview/ZenFloatingQuickPreview";
import { ZenPinnedPreview } from "../src/views/fileLibrary/preview/ZenPinnedPreview";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const capabilities: PreviewCapabilities = {
  canSearch: false,
  canZoom: false,
  canPlayback: false,
  canSelectText: false,
  canNavigateInternal: false,
  canNavigateSiblings: false,
  canOpenExternal: false,
  canReveal: false,
  canRequestMaterialization: false
};

const source: PreviewSourceProjection = {
  key: "library:query:1:preview-w608-host",
  generation: "library:query:1",
  source: "library",
  previewSource: { kind: "managed", fileId: "preview-w608-host" },
  displayName: "preview-w608-host.png",
  entryKind: "file",
  extension: "png"
};

function imageSnapshot(hostKind: PreviewHostKind): PreviewSnapshot {
  return {
    previewId: `preview-w608-${hostKind}`,
    sessionId: `session-w608-${hostKind}`,
    requestId: `request-w608-${hostKind}`,
    source: source.previewSource,
    hostKind,
    state: "ready",
    sourceVersion: `version-w608-${hostKind}`,
    representation: {
      sourceVersion: `version-w608-${hostKind}`,
      representation: { family: "image", assetToken: `image-w608-${hostKind}`, mediaType: "image/png" },
      completeness: "complete",
      warnings: [],
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

function previewState(host: "floating" | "pinned"): PreviewExperienceState {
  const hostKind: PreviewHostKind = host === "floating" ? "zen_floating" : "zen_pinned";
  return {
    visible: true,
    host,
    frontendEpoch: 1,
    source,
    previewId: `preview-w608-${hostKind}`,
    snapshot: imageSnapshot(hostKind),
    phase: "content",
    navigation: null,
    navigationBusy: false
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("W6-08 Quick Preview image host projection", () => {
  it("keeps Floating and Pinned content state and announcements loading until image load", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalWindowImage = window.Image;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:w608-host-image") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    hostHarness.t = makeTranslator("en");

    try {
      for (const [host, Component] of [
        ["floating", ZenFloatingQuickPreview],
        ["pinned", ZenPinnedPreview]
      ] as const) {
        const pending = deferred<PreviewAssetArtifact>();
        const controller = {
          close: vi.fn(() => true),
          pin: vi.fn(() => Promise.resolve(true)),
          requestPreviewAsset: vi.fn(() => pending.promise),
          restoreFocusTarget: vi.fn(() => null),
          updateNativePreviewGeometry: vi.fn(() => Promise.resolve(null))
        };
        hostHarness.value = { controller, state: previewState(host) };
        let preloader: ControlledImage | null = null;
        class ControlledImage {
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          src = "";
          constructor() {
            preloader = this;
          }
        }
        vi.stubGlobal("Image", ControlledImage);
        Object.defineProperty(window, "Image", { configurable: true, value: ControlledImage });
        const container = document.body.appendChild(document.createElement("div"));
        let root: Root | undefined = createRoot(container);
        try {
          await act(async () => root?.render(createElement(Component)));
          await settle();
          expect(container.querySelector('[data-preview-content-state="loading"]')).not.toBeNull();
          expect(container.querySelector('[data-preview-state-announcement="true"]')?.textContent)
            .toBe("Preparing preview");
          expect(container.querySelector('[data-preview-image-loading="true"]')).not.toBeNull();

          pending.resolve({ mediaType: "image/png", bytes: new Uint8Array([137, 80, 78, 71]) });
          await settle();
          expect(container.querySelector('[data-preview-content-state="loading"]')).not.toBeNull();

          await act(async () => {
            preloader?.onload?.();
            await Promise.resolve();
          });
          expect(container.querySelector('[data-preview-content-state="ready"]')).not.toBeNull();
          expect(container.querySelector('[data-preview-state-announcement="true"]')?.textContent)
            .toBe("Preview content ready");
        } finally {
          act(() => root?.unmount());
          root = undefined;
          container.remove();
        }
      }
    } finally {
      hostHarness.value = null;
      if (originalCreateObjectURL === undefined) Reflect.deleteProperty(URL, "createObjectURL");
      else Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      if (originalRevokeObjectURL === undefined) Reflect.deleteProperty(URL, "revokeObjectURL");
      else Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      Object.defineProperty(window, "Image", { configurable: true, value: originalWindowImage });
    }
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
