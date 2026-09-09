// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { Translator } from "../src/types/ui";
import type {
  PreviewAssetArtifact,
  PreviewAssetRequest,
  PreviewCapabilities,
  PreviewRepresentation,
  PreviewSnapshot,
  PreviewWarning
} from "../src/types/fileWorkspace";
import {
  previewFallbackState,
  previewPresentationState
} from "../src/views/fileLibrary/preview/previewExperienceController";
import {
  metadataFromSnapshot,
  previewImageRequestKey,
  previewStateAnnouncement,
  renderPreviewBody
} from "../src/views/fileLibrary/preview/PreviewContent";
import type { PreviewSourceProjection } from "../src/views/fileLibrary/preview/previewSource";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const t = ((key: string) => key) as Translator;
const capabilities: PreviewCapabilities = {
  canSearch: false,
  canZoom: false,
  canPlayback: false,
  canSelectText: true,
  canNavigateInternal: false,
  canNavigateSiblings: false,
  canOpenExternal: false,
  canReveal: false,
  canRequestMaterialization: false
};

const source: PreviewSourceProjection = {
  key: "library:query:1:preview-w608",
  generation: "library:query:1",
  source: "library",
  previewSource: { kind: "managed", fileId: "preview-w608" },
  displayName: "preview-w608.json",
  entryKind: "file",
  extension: "json"
};

function snapshot(
  representation: PreviewRepresentation,
  completeness: "complete" | "partial" | "unknown" = "complete",
  warnings: PreviewWarning[] = []
): PreviewSnapshot {
  return {
    previewId: "preview-w608",
    sessionId: "preview-w608",
    requestId: "request-w608",
    source: source.previewSource,
    hostKind: "zen_floating",
    state: "ready",
    sourceVersion: "version-w608",
    representation: {
      sourceVersion: "version-w608",
      representation,
      completeness,
      warnings,
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

function metadataSnapshot(reason?: "unsupported" | "failed" | "timeout" | "corrupt_source") {
  return snapshot({
    family: "metadata",
    metadata: {
      displayName: source.displayName,
      mediaType: "application/json",
      extension: "json",
      sizeBytes: 128,
      modifiedAtEpochMs: 1,
      materialization: "local",
      readEligibility: "eligible"
    }
  }, "complete", [
    ...(reason === undefined ? [] : [{
      kind: "provider_fallback" as const,
      providerId: "builtin.structured-json",
      reason
    }]),
    { kind: "metadata_fallback" }
  ]);
}

function tableSnapshot(
  columns: string[],
  rows: string[][],
  truncation: { rows: boolean; columns: boolean; cells: boolean },
  completeness: "complete" | "partial" = "complete",
  format: "csv" | "tsv" = "csv"
) {
  return snapshot({
    family: "table",
    encodedTable: JSON.stringify({
      schemaVersion: 1,
      format,
      columns,
      rows,
      truncation
    })
  }, completeness);
}

function imageSnapshot(): PreviewSnapshot {
  return snapshot({ family: "image", assetToken: "image-w608", mediaType: "image/png" });
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("W6-08 Quick Preview experience state and bounded content", () => {
  it("projects ready, partial, fallback, unavailable, failed, permission, and materialization states distinctly", () => {
    expect(previewPresentationState("content", snapshot({ family: "text", text: "ready", language: null }))).toBe("ready");
    expect(previewPresentationState("content", snapshot({ family: "text", text: "partial", language: null }, "partial"))).toBe("partial");
    expect(previewPresentationState("content", imageSnapshot())).toBe("loading");
    expect(previewPresentationState("content")).toBe("failed");
    expect(previewPresentationState("metadata_fallback", metadataSnapshot("unsupported"))).toBe("unsupported");
    expect(previewPresentationState("metadata_fallback", metadataSnapshot("corrupt_source"))).toBe("failed");
    expect(previewPresentationState("metadata_fallback", metadataSnapshot())).toBe("metadata_fallback");
    expect(previewPresentationState("source_unavailable")).toBe("unavailable");
    expect(previewPresentationState("permission_denied")).toBe("permission_required");
    expect(previewPresentationState("materialization_required")).toBe("materialization_required");
    expect(previewPresentationState("error")).toBe("failed");
    expect(previewFallbackState(metadataSnapshot("timeout"))).toBe("failed");
  });

  it("keeps empty CSV and TSV wording format-neutral and exposes every bounded truncation dimension", () => {
    const empty = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      t,
      tableSnapshot([], [], { rows: false, columns: false, cells: false })
    ));
    expect(empty).toContain('data-preview-table-empty="true"');
    expect(empty).toContain('data-preview-empty="true"');
    expect(empty).toContain("previewTableEmpty");
    expect(empty).not.toContain("<table>");

    const emptyCsv = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      makeTranslator("en"),
      tableSnapshot([], [], { rows: false, columns: false, cells: false }, "complete", "csv")
    ));
    const emptyTsv = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      makeTranslator("en"),
      tableSnapshot([], [], { rows: false, columns: false, cells: false }, "complete", "tsv")
    ));
    expect(emptyCsv).toContain("This table has no content to display.");
    expect(emptyTsv).toContain("This table has no content to display.");
    expect(emptyTsv).not.toContain("CSV");

    const emptyZh = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "zh",
      makeTranslator("zh"),
      tableSnapshot([], [], { rows: false, columns: false, cells: false }, "complete", "tsv")
    ));
    expect(emptyZh).toContain("此表格没有可显示的内容。");
    expect(emptyZh).not.toContain("CSV");

    const partial = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      t,
      tableSnapshot(["Name", "Value"], [["bounded", "value"]], { rows: true, columns: true, cells: true })
    ));
    expect(partial).toContain('data-preview-truncated="true"');
    expect(partial).toContain('data-preview-truncation="rows,columns,cells"');
    expect(partial).toContain('data-preview-partial="true"');
  });

  it("keeps malformed JSON/CSV provider failures separate from unsupported fallback", () => {
    const failedSnapshot = metadataSnapshot("corrupt_source");
    const failed = renderToStaticMarkup(renderPreviewBody(
      "metadata_fallback",
      source,
      metadataFromSnapshot(failedSnapshot),
      "en",
      t,
      failedSnapshot
    ));
    expect(failed).toContain('data-preview-fallback-state="failed"');
    expect(failed).toContain("previewContentFailed");
    expect(failed).not.toContain("previewRichProviderUnavailable");

    const unsupportedSnapshot = metadataSnapshot("unsupported");
    const unsupported = renderToStaticMarkup(renderPreviewBody(
      "metadata_fallback",
      source,
      metadataFromSnapshot(unsupportedSnapshot),
      "en",
      t,
      unsupportedSnapshot
    ));
    expect(unsupported).toContain('data-preview-fallback-state="unsupported"');
    expect(unsupported).toContain("previewUnsupportedRepresentation");
    expect(unsupported).toContain("previewUnsupportedRepresentationDescription");
    expect(unsupported).toContain("application/json");

    const englishFallback = renderToStaticMarkup(renderPreviewBody(
      "metadata_fallback",
      source,
      metadataFromSnapshot(unsupportedSnapshot),
      "en",
      makeTranslator("en"),
      unsupportedSnapshot
    ));
    expect(englishFallback).toContain("trusted metadata remains visible");

    const directUnsupported = renderToStaticMarkup(renderPreviewBody(
      "unsupported_representation",
      source,
      null,
      "en",
      makeTranslator("en"),
      unsupportedSnapshot
    ));
    expect(directUnsupported).toContain("No safe content representation is available for this item.");
    expect(directUnsupported).not.toContain("trusted metadata remains visible");

    const directUnsupportedZh = renderToStaticMarkup(renderPreviewBody(
      "unsupported_representation",
      source,
      null,
      "zh",
      makeTranslator("zh"),
      unsupportedSnapshot
    ));
    expect(directUnsupportedZh).toContain("此项目没有可用的安全内容表示。");
    expect(directUnsupportedZh).not.toContain("仍显示可信元数据");

    const unknownRepresentation = { family: "future_representation" } as unknown as PreviewRepresentation;
    const unknown = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      makeTranslator("en"),
      snapshot(unknownRepresentation)
    ));
    expect(unknown).toContain("No safe content representation is available for this item.");
    expect(unknown).not.toContain("trusted metadata remains visible");
  });

  it("keeps image asset lifecycle state truthful and publishes it to the host", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalWindowImage = window.Image;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:w608-image") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const container = document.body.appendChild(document.createElement("div"));
    let root: Root | undefined = createRoot(container);
    class ControlledImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";
      constructor() {
        preloader = this;
      }
    }
    let preloader: ControlledImage | null = null;
      vi.stubGlobal("Image", ControlledImage);
    Object.defineProperty(window, "Image", { configurable: true, value: ControlledImage });
    try {
      const pending = deferred<PreviewAssetArtifact>();
      const requestPreviewAsset = vi.fn(() => pending.promise);
      const publishPresentation = vi.fn();

      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot(), requestPreviewAsset, undefined, publishPresentation)));
      await settle();
      const requestKey = previewImageRequestKey(imageSnapshot(), source);
      expect(requestKey).not.toBeNull();
      expect(publishPresentation).toHaveBeenLastCalledWith(requestKey, "loading");
      expect(container.querySelector('[data-preview-image-status="loading"]')).not.toBeNull();
      expect(container.querySelector('[data-preview-image-loading="true"]')).not.toBeNull();
      expect(previewPresentationState("content", imageSnapshot(), "loading")).toBe("loading");
      expect(previewStateAnnouncement("content", t, imageSnapshot(), "loading")).toBe("previewLoading");

      pending.resolve({
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71])
      });
      await settle();
      expect(container.querySelector('[data-preview-image-status="loading"]')).not.toBeNull();
      expect(container.querySelector("img")).toBeNull();
      expect(publishPresentation).toHaveBeenLastCalledWith(requestKey, "loading");

      await act(async () => {
        preloader?.onload?.();
        await Promise.resolve();
      });
      expect(container.querySelector('[data-preview-image-status="ready"]')).not.toBeNull();
      expect(publishPresentation).toHaveBeenLastCalledWith(requestKey, "ready");
      expect(previewPresentationState("content", imageSnapshot(), "ready")).toBe("ready");
      expect(previewStateAnnouncement("content", t, imageSnapshot(), "ready")).toBe("previewContentReady");

      const unsupportedAsset = vi.fn(async (): Promise<PreviewAssetArtifact> => ({
        mediaType: "image/gif",
        bytes: new Uint8Array([71, 73, 70])
      }));
      const unsupportedPresentation = vi.fn();
      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot(), unsupportedAsset, undefined, unsupportedPresentation)));
      await settle();
      expect(container.querySelector('[data-preview-image-failure="unsupported"]')).not.toBeNull();
      expect(unsupportedPresentation).toHaveBeenLastCalledWith(requestKey, "unsupported");
      expect(previewPresentationState("content", imageSnapshot(), "unsupported")).toBe("unsupported");
      expect(previewStateAnnouncement("content", t, imageSnapshot(), "unsupported")).toBe("previewImageUnsupported");

      const unavailablePresentation = vi.fn();
      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot(), undefined, undefined, unavailablePresentation)));
      await settle();
      expect(container.querySelector('[data-preview-image-failure="unavailable"]')).not.toBeNull();
      expect(unavailablePresentation).toHaveBeenLastCalledWith(requestKey, "unavailable");
      expect(container.textContent).toContain("previewImageUnavailable");
      expect(previewPresentationState("content", imageSnapshot(), "unavailable")).toBe("unavailable");
      expect(previewStateAnnouncement("content", t, imageSnapshot(), "unavailable")).toBe("previewImageUnavailable");
    } finally {
      act(() => root?.unmount());
      root = undefined;
      container.remove();
      if (originalCreateObjectURL === undefined) Reflect.deleteProperty(URL, "createObjectURL");
      else Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      if (originalRevokeObjectURL === undefined) Reflect.deleteProperty(URL, "revokeObjectURL");
      else Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      Object.defineProperty(window, "Image", { configurable: true, value: originalWindowImage });
    }
  });

  it("keeps rejected image assets failed and prevents stale or closed responses from publishing", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:w608-image") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const container = document.body.appendChild(document.createElement("div"));
    let root: Root | undefined = createRoot(container);
    try {
      const first = deferred<PreviewAssetArtifact>();
      const second = deferred<PreviewAssetArtifact>();
      const requests = vi.fn((request: PreviewAssetRequest) => request.requestId === "request-w608" ? first.promise : second.promise);
      const publishPresentation = vi.fn();
      const sourceB: PreviewSourceProjection = {
        ...source,
        key: "library:query:1:preview-w608-b",
        displayName: "preview-w608-b.json"
      };
      const snapshotB = {
        ...imageSnapshot(),
        previewId: "preview-w608-b",
        sessionId: "preview-w608-b",
        requestId: "request-w608-b",
        source: sourceB.previewSource,
        sourceVersion: "version-w608-b",
        representation: {
          ...imageSnapshot().representation!,
          sourceVersion: "version-w608-b"
        }
      };

      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot(), requests, undefined, publishPresentation)));
      await settle();
      const keyA = previewImageRequestKey(imageSnapshot(), source);
      expect(publishPresentation).toHaveBeenLastCalledWith(keyA, "loading");

      await act(async () => root?.render(renderPreviewBody("content", sourceB, null, "en", t, snapshotB, requests, undefined, publishPresentation)));
      await settle();
      const keyB = previewImageRequestKey(snapshotB, sourceB);
      expect(keyB).not.toBe(keyA);
      expect(container.querySelector('[data-preview-image-status="loading"]')).not.toBeNull();
      first.resolve({ mediaType: "image/png", bytes: new Uint8Array([1]) });
      await settle();
      expect(publishPresentation).toHaveBeenLastCalledWith(keyB, "loading");
      expect(container.querySelector('[data-preview-image-status="ready"]')).toBeNull();

      second.reject(new Error("asset failed"));
      await settle();
      expect(container.querySelector('[data-preview-image-failure="failed"]')).not.toBeNull();
      expect(publishPresentation).toHaveBeenLastCalledWith(keyB, "failed");

      const updateCountBeforeClose = publishPresentation.mock.calls.length;
      await act(async () => root?.unmount());
      root = undefined;
      first.resolve({ mediaType: "image/png", bytes: new Uint8Array([2]) });
      second.resolve({ mediaType: "image/png", bytes: new Uint8Array([3]) });
      await settle();
      expect(publishPresentation).toHaveBeenCalledTimes(updateCountBeforeClose);
    } finally {
      act(() => root?.unmount());
      root = undefined;
      container.remove();
      if (originalCreateObjectURL === undefined) Reflect.deleteProperty(URL, "createObjectURL");
      else Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      if (originalRevokeObjectURL === undefined) Reflect.deleteProperty(URL, "revokeObjectURL");
      else Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
    }
  });

  it("labels browser image decode failure without calling it unsupported", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalWindowImage = window.Image;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:w608-image") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const container = document.body.appendChild(document.createElement("div"));
    let root: Root | undefined = createRoot(container);
    try {
      class ControlledImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "";
        constructor() {
          preloader = this;
        }
      }
      let preloader: ControlledImage | null = null;
    vi.stubGlobal("Image", ControlledImage);
      Object.defineProperty(window, "Image", { configurable: true, value: ControlledImage });
      const requestPreviewAsset = vi.fn(async (): Promise<PreviewAssetArtifact> => ({
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71])
      }));

      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot(), requestPreviewAsset)));
      await settle();
      await act(async () => {
        preloader?.onload?.();
        await Promise.resolve();
      });
      const image = container.querySelector<HTMLImageElement>("img");
      expect(image).not.toBeNull();
      await act(async () => {
        image?.dispatchEvent(new Event("error", { bubbles: false }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-preview-image-failure="failed"]')).not.toBeNull();
      expect(container.textContent).toContain("previewImageFailed");
      expect(container.textContent).not.toContain("previewUnsupportedRepresentation");
    } finally {
      act(() => root?.unmount());
      root = undefined;
      container.remove();
      if (originalCreateObjectURL === undefined) Reflect.deleteProperty(URL, "createObjectURL");
      else Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      if (originalRevokeObjectURL === undefined) Reflect.deleteProperty(URL, "revokeObjectURL");
      else Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      Object.defineProperty(window, "Image", { configurable: true, value: originalWindowImage });
    }
  });

  it("does not publish a late asset response after the preview host closes", async () => {
    const container = document.body.appendChild(document.createElement("div"));
    let root: Root | undefined = createRoot(container);
    try {
      const pending = deferred<PreviewAssetArtifact>();
      const requestPreviewAsset = vi.fn(() => pending.promise);
      const publishPresentation = vi.fn();
      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot(), requestPreviewAsset, undefined, publishPresentation)));
      await settle();
      const callsBeforeClose = publishPresentation.mock.calls.length;
      await act(async () => root?.unmount());
      root = undefined;
      pending.resolve({ mediaType: "image/png", bytes: new Uint8Array([1]) });
      await settle();
      expect(publishPresentation).toHaveBeenCalledTimes(callsBeforeClose);
    } finally {
      act(() => root?.unmount());
      root = undefined;
      container.remove();
    }
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
