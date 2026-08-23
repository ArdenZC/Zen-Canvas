// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Translator } from "../src/types/ui";
import type {
  PreviewAssetArtifact,
  PreviewAssetRequest,
  PreviewCapabilities,
  PreviewRepresentation,
  PreviewSnapshot
} from "../src/types/fileWorkspace";
import { renderPreviewBody } from "../src/views/fileLibrary/preview/PreviewContent";
import type { PreviewSourceProjection } from "../src/views/fileLibrary/preview/previewSource";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const t = ((key: string) => key) as Translator;
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
  key: "library:query:1:image-a",
  generation: "library:query:1",
  source: "library",
  previewSource: { kind: "managed", fileId: "image-a" },
  displayName: "C:\\private\\folder/image-a.png",
  entryKind: "file",
  extension: "png"
};

function imageRepresentation(assetToken: string, mediaType = "image/png"): PreviewRepresentation {
  return { family: "image", assetToken, mediaType };
}

function imageSnapshot(
  assetToken: string,
  currentSource = source,
  completeness: "complete" | "partial" = "complete"
): PreviewSnapshot {
  return {
    previewId: "preview-image",
    sessionId: "preview-image",
    requestId: `request-${assetToken}`,
    source: currentSource.previewSource,
    hostKind: "zen_floating",
    state: "ready",
    sourceVersion: `version-${assetToken}`,
    representation: {
      sourceVersion: `version-${assetToken}`,
      representation: imageRepresentation(assetToken),
      completeness,
      warnings: [],
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

function renderImage(
  snapshot: PreviewSnapshot,
  requestPreviewAsset?: (request: PreviewAssetRequest) => Promise<PreviewAssetArtifact>,
  currentSource = source
) {
  return renderPreviewBody("content", currentSource, null, "en", t, snapshot, requestPreviewAsset);
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;
let createdUrls: string[];
let revokedUrls: string[];

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("W3-06 shared image preview renderer", () => {
  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        const url = `blob:w306-${createdUrls.length + 1}`;
        createdUrls.push(url);
        return url;
      })
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn((url: string) => {
        revokedUrls.push(url);
      })
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    if (originalCreateObjectURL === undefined) Reflect.deleteProperty(URL, "createObjectURL");
    else Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
    if (originalRevokeObjectURL === undefined) Reflect.deleteProperty(URL, "revokeObjectURL");
    else Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
  });

  it("enters the content phase, requests the exact tuple, fits the image, and discloses Partial", async () => {
    const requests: PreviewAssetRequest[] = [];
    const requestPreviewAsset = vi.fn(async (request: PreviewAssetRequest) => {
      requests.push(request);
      return { mediaType: "image/png", bytes: new Uint8Array([137, 80, 78, 71]) };
    });
    const current = imageSnapshot("asset-a", source, "partial");

    await act(async () => root?.render(renderImage(current, requestPreviewAsset)));
    await settle();

    expect(container?.querySelector('[data-preview-representation="image"]')).not.toBeNull();
    expect(container?.querySelector('[data-preview-partial="true"]')).not.toBeNull();
    expect(requests).toEqual([{
      previewId: "preview-image",
      requestId: "request-asset-a",
      sourceVersion: "version-asset-a",
      assetToken: "asset-a"
    }]);
    expect(container?.querySelector("img")?.getAttribute("src")).toBe("blob:w306-1");
    expect(container?.querySelector("img")?.getAttribute("alt")).toBe("C: private folder image-a.png");
    expect(container?.querySelector(".zc-preview-image-value")?.className).toContain("zc-preview-image-value");

    await act(async () => root?.render(renderImage(current, requestPreviewAsset)));
    await settle();
    expect(requestPreviewAsset).toHaveBeenCalledTimes(1);
    expect(createdUrls).toEqual(["blob:w306-1"]);
  });

  it("fails closed on an asset media-type mismatch", async () => {
    const requestPreviewAsset = vi.fn(async () => ({
      mediaType: "image/jpeg",
      bytes: new Uint8Array([1, 2, 3])
    }));

    await act(async () => root?.render(renderImage(imageSnapshot("asset-mismatch"), requestPreviewAsset)));
    await settle();

    expect(container?.querySelector('[data-preview-image-failed="true"]')).not.toBeNull();
    expect(createdUrls).toHaveLength(0);
  });

  it("does not let a stale A response create or commit an object URL after switching to B", async () => {
    const pending = new Map<string, (artifact: PreviewAssetArtifact) => void>();
    const requestPreviewAsset = vi.fn((request: PreviewAssetRequest) => new Promise<PreviewAssetArtifact>((resolve) => {
      pending.set(request.assetToken, resolve);
    }));
    const sourceB: PreviewSourceProjection = {
      ...source,
      key: "library:query:1:image-b",
      previewSource: { kind: "managed", fileId: "image-b" },
      displayName: "image-b.png"
    };
    const snapshotA = imageSnapshot("asset-a");
    const snapshotB = imageSnapshot("asset-b", sourceB);

    await act(async () => root?.render(renderImage(snapshotA, requestPreviewAsset)));
    await act(async () => root?.render(renderImage(snapshotB, requestPreviewAsset, sourceB)));
    await act(async () => {
      pending.get("asset-a")?.({ mediaType: "image/png", bytes: new Uint8Array([1]) });
      await Promise.resolve();
    });
    expect(createdUrls).toHaveLength(0);
    expect(container?.querySelector('[data-preview-image-loading="true"]')).not.toBeNull();

    await act(async () => {
      pending.get("asset-b")?.({ mediaType: "image/png", bytes: new Uint8Array([2]) });
      await Promise.resolve();
    });
    expect(createdUrls).toEqual(["blob:w306-1"]);
    expect(container?.querySelector("img")?.getAttribute("src")).toBe("blob:w306-1");

    act(() => root?.unmount());
    expect(revokedUrls).toEqual(["blob:w306-1"]);
  });
});
