import { describe, expect, it } from "vitest";
import { parsePreviewRepresentationEnvelope, parsePreviewSnapshot } from "../src/api/fileWorkspacePreviewWire";
import type { PreviewMetadata, PreviewRepresentation } from "../src/types/fileWorkspace";

const capabilities = {
  canSearch: true,
  canZoom: true,
  canPlayback: true,
  canSelectText: true,
  canNavigateInternal: true,
  canNavigateSiblings: true,
  canOpenExternal: true,
  canReveal: true,
  canRequestMaterialization: false
};

const metadata: PreviewMetadata = {
  displayName: "sample.txt",
  mediaType: "text/plain",
  extension: "txt",
  sizeBytes: 4,
  modifiedAtEpochMs: 1,
  materialization: "boundary_readable",
  readEligibility: "eligible"
};

const representations: PreviewRepresentation[] = [
  { family: "metadata", metadata },
  { family: "text", text: "text", language: "text" },
  { family: "safe_html", html: "<p>safe</p>" },
  { family: "structured_tree", encodedTree: "{}" },
  { family: "table", encodedTable: "[]" },
  { family: "image", assetToken: "preview-asset-image", mediaType: "image/png" },
  { family: "media", assetToken: "preview-asset-media", mediaType: "audio/mpeg" },
  { family: "folder_summary", encodedSummary: "{}" },
  { family: "archive_tree", encodedTree: "{}" },
  { family: "native_opaque", host: "zen_floating", token: "native-token" }
];

function envelope(representation: PreviewRepresentation) {
  return {
    sourceVersion: "version-1",
    representation,
    completeness: "complete" as const,
    warnings: [
      { kind: "provider_fallback" as const, providerId: "provider-1", reason: "timeout" as const },
      { kind: "metadata_fallback" as const },
      { kind: "terminal_condition" as const, condition: "materialization_required" as const }
    ],
    capabilities
  };
}

describe("W3-01 strict Preview wire", () => {
  it("accepts every Rust representation family with exact fields", () => {
    for (const representation of representations) {
      expect(parsePreviewRepresentationEnvelope(envelope(representation), "zen_floating").representation)
        .toEqual(representation);
    }
  });

  it("rejects unknown families, warnings and fields", () => {
    expect(() => parsePreviewRepresentationEnvelope({
      ...envelope({ family: "text", text: "x", language: null }),
      representation: { family: "future_family", value: "x" }
    }, "zen_floating")).toThrow("preview_representation_family_unknown");
    expect(() => parsePreviewRepresentationEnvelope({
      ...envelope({ family: "text", text: "x", language: null }),
      warnings: [{ kind: "future_warning" }]
    }, "zen_floating")).toThrow("preview_warning_kind_unknown");
    expect(() => parsePreviewRepresentationEnvelope({
      ...envelope({ family: "text", text: "x", language: null }),
      representation: { family: "text", text: "x", language: null, path: "C:\\secret" }
    }, "zen_floating")).toThrow("preview_wire_unknown_or_missing_field");
    expect(() => parsePreviewRepresentationEnvelope({
      ...envelope({ family: "image", assetToken: "C:\\secret", mediaType: "image/png" })
    }, "zen_floating")).toThrow("preview_asset_token_invalid");
  });

  it("keeps NativeOpaque host-bound and snapshot outer wire strict", () => {
    expect(() => parsePreviewRepresentationEnvelope(
      envelope({ family: "native_opaque", host: "zen_pinned", token: "native-token" }),
      "zen_floating"
    )).toThrow("preview_native_host_mismatch");
    expect(() => parsePreviewSnapshot({
      previewId: "preview-1",
      sessionId: "preview-1",
      requestId: "request-1",
      source: { kind: "managed", fileId: "file-1" },
      hostKind: "zen_floating",
      state: "idle",
      effectiveCapabilities: capabilities,
      path: "C:\\secret"
    })).toThrow("preview_wire_unknown_or_missing_field");
  });
});
