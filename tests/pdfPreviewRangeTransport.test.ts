import { describe, expect, it } from "vitest";
import {
  pdfPageNumbers,
  PreviewPdfRangeTransport,
  PDF_RANGE_CHUNK_BYTES
} from "../src/views/fileLibrary/preview/renderers/PdfPreviewRenderer";
import type { PreviewAssetRequest } from "../src/types/fileWorkspace";

const request: Omit<PreviewAssetRequest, "offsetBytes" | "maxBytes"> = {
  previewId: "preview-pdf",
  requestId: "request-pdf",
  sourceVersion: "source-pdf",
  assetToken: "asset-pdf"
};

describe("PreviewPdfRangeTransport", () => {
  it.each([
    [1, 1],
    [12, 12],
    [200, 200]
  ])("keeps the full logical page list for %i pages", (totalPages, expectedLength) => {
    const pages = pdfPageNumbers(totalPages);
    expect(pages).toHaveLength(expectedLength);
    expect(pages[0]).toBe(1);
    expect(pages.at(-1)).toBe(expectedLength);
  });

  it("keeps each backend read at one MiB while returning one contiguous PDF.js range", async () => {
    const calls: PreviewAssetRequest[] = [];
    const ranges: Array<{ begin: number; length: number }> = [];
    const transport = new PreviewPdfRangeTransport(
      3 * PDF_RANGE_CHUNK_BYTES,
      request,
      async (nextRequest) => {
        calls.push(nextRequest);
        return {
          mediaType: "application/pdf",
          bytes: new Uint8Array(nextRequest.maxBytes ?? 0)
        };
      }
    );
    transport.onDataRange = (begin, bytes) => {
      ranges.push({ begin, length: bytes?.byteLength ?? 0 });
    };

    transport.requestDataRange(0, 2 * PDF_RANGE_CHUNK_BYTES + 128);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.map(({ offsetBytes, maxBytes }) => [offsetBytes, maxBytes])).toEqual([
      [0, PDF_RANGE_CHUNK_BYTES],
      [PDF_RANGE_CHUNK_BYTES, PDF_RANGE_CHUNK_BYTES],
      [2 * PDF_RANGE_CHUNK_BYTES, 128]
    ]);
    expect(calls.every(({ maxBytes }) => maxBytes !== undefined && maxBytes <= PDF_RANGE_CHUNK_BYTES)).toBe(true);
    expect(ranges).toEqual([{ begin: 0, length: 2 * PDF_RANGE_CHUNK_BYTES + 128 }]);
  });

  it("reports a bounded read failure and does not leave PDF.js waiting forever", async () => {
    const errors: unknown[] = [];
    const transport = new PreviewPdfRangeTransport(
      PDF_RANGE_CHUNK_BYTES,
      request,
      async () => {
        throw new Error("read-denied");
      }
    );
    transport.setErrorHandler((error) => errors.push(error));
    transport.requestDataRange(0, 128);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe("read-denied");
  });
});
