// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Translator } from "../src/types/ui";
import type {
  PreviewAssetArtifact,
  PreviewCapabilities,
  PreviewRepresentation,
  PreviewSnapshot,
  PreviewWarning
} from "../src/types/fileWorkspace";
import {
  previewFallbackState,
  previewPresentationState
} from "../src/views/fileLibrary/preview/previewExperienceController";
import { metadataFromSnapshot, renderPreviewBody } from "../src/views/fileLibrary/preview/PreviewContent";
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
  completeness: "complete" | "partial" = "complete"
) {
  return snapshot({
    family: "table",
    encodedTable: JSON.stringify({
      schemaVersion: 1,
      format: "csv",
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

describe("W6-08 Quick Preview experience state and bounded content", () => {
  it("projects ready, partial, fallback, unavailable, failed, permission, and materialization states distinctly", () => {
    expect(previewPresentationState("content", snapshot({ family: "text", text: "ready", language: null }))).toBe("ready");
    expect(previewPresentationState("content", snapshot({ family: "text", text: "partial", language: null }, "partial"))).toBe("partial");
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

  it("renders an explicit empty CSV and exposes every bounded truncation dimension", () => {
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
  });

  it("labels browser asset unavailability and image decode failure without calling either unsupported", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:w608-image") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const container = document.body.appendChild(document.createElement("div"));
    let root: Root | undefined = createRoot(container);
    try {
      const requestPreviewAsset = vi.fn(async (): Promise<PreviewAssetArtifact> => ({
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71])
      }));

      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot(), requestPreviewAsset)));
      await settle();
      const image = container.querySelector<HTMLImageElement>("img");
      expect(image).not.toBeNull();
      await act(async () => {
        image?.dispatchEvent(new Event("error", { bubbles: false }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-preview-image-failure="failed"]')).not.toBeNull();
      expect(container.textContent).toContain("previewImageFailed");
      expect(container.textContent).not.toContain("previewUnsupportedRepresentation");

      await act(async () => root?.render(renderPreviewBody("content", source, null, "en", t, imageSnapshot())));
      await settle();
      expect(container.querySelector('[data-preview-image-failure="unavailable"]')).not.toBeNull();
      expect(container.textContent).toContain("previewImageUnavailable");
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
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
