import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
} from "react";
import { PDFDataRangeTransport } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport
} from "pdfjs-dist";
import { useI18nContext } from "../../../../contexts/AppContexts";
import type {
  PreviewAssetArtifact,
  PreviewAssetRequest,
  PreviewRepresentation,
  PreviewRepresentationEnvelope,
  PreviewSnapshot
} from "../../../../types/fileWorkspace";
import type { PreviewSourceProjection } from "../previewSource";
import type {
  PreviewExperienceState,
  PreviewImagePresentationState
} from "../previewExperienceController";

type PreviewAssetRequestHandler = (request: PreviewAssetRequest) => Promise<PreviewAssetArtifact>;
type PdfRepresentation = Extract<PreviewRepresentation, { family: "pdf" }>;

export type PdfPreviewPresentationHandler = (
  requestKey: string,
  state: PreviewImagePresentationState
) => void;

export const PDF_RANGE_CHUNK_BYTES = 1024 * 1024;
const PDF_MEDIA_TYPE = "application/pdf";
const PDF_NEARBY_ROOT_MARGIN = "800px 0px";
const PDF_ESTIMATED_PAGE_HEIGHT = 760;

export function pdfPageNumbers(totalPages: number): number[] {
  if (!Number.isSafeInteger(totalPages) || totalPages <= 0) return [];
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

type PdfStatus = "loading" | "ready" | "failed" | "corrupt" | "encrypted" | "cancelled" | "stale";
type PdfScaleMode = "fit-width" | "fit-page" | "manual";

/**
 * PDF.js asks for arbitrary [begin, end) ranges. This adapter splits every
 * request at the existing Preview Read Gate ceiling and keeps the browser
 * free of paths, URLs, and a full-document Uint8Array.
 */
export class PreviewPdfRangeTransport extends PDFDataRangeTransport {
  private aborted = false;
  private readonly requests = new Set<Promise<void>>();
  private errorHandler: ((error: unknown) => void) | null = null;

  constructor(
    length: number,
    private readonly request: Omit<PreviewAssetRequest, "offsetBytes" | "maxBytes">,
    private readonly requestPreviewAsset: PreviewAssetRequestHandler,
    contentDispositionFilename?: string
  ) {
    super(length, null, false, contentDispositionFilename);
  }

  override requestDataRange(begin: number, end: number) {
    if (
      this.aborted
      || !Number.isSafeInteger(begin)
      || !Number.isSafeInteger(end)
      || begin < 0
      || end <= begin
      || end > this.length
    ) return;
    const operation = this.fetchRange(begin, end);
    this.requests.add(operation);
    void operation
      .catch((error: unknown) => {
        if (!this.aborted) this.errorHandler?.(error);
      })
      .finally(() => this.requests.delete(operation))
      .catch(() => undefined);
  }

  override abort() {
    this.aborted = true;
  }

  setErrorHandler(handler: (error: unknown) => void) {
    this.errorHandler = handler;
  }

  private async fetchRange(begin: number, end: number) {
    let offset = begin;
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (!this.aborted && offset < end) {
      const maxBytes = Math.min(PDF_RANGE_CHUNK_BYTES, end - offset);
      const artifact = await this.requestPreviewAsset({
        ...this.request,
        offsetBytes: offset,
        maxBytes
      });
      if (this.aborted) return;
      if (artifact.mediaType.toLowerCase() !== PDF_MEDIA_TYPE) {
        throw new Error("preview_pdf_media_type_invalid");
      }
      const bytes = artifact.bytes instanceof Uint8Array
        ? artifact.bytes
        : new Uint8Array(artifact.bytes);
      if (bytes.byteLength !== maxBytes) {
        throw new Error("preview_pdf_range_invalid");
      }
      chunks.push(bytes);
      byteLength += bytes.byteLength;
      offset += bytes.byteLength;
      if (bytes.byteLength < maxBytes && offset < end) {
        throw new Error("preview_pdf_range_truncated");
      }
    }
    if (this.aborted) return;
    const merged = chunks.length === 1 ? chunks[0]! : new Uint8Array(byteLength);
    if (chunks.length > 1) {
      let cursor = 0;
      for (const chunk of chunks) {
        merged.set(chunk, cursor);
        cursor += chunk.byteLength;
      }
    }
    this.onDataRange(begin, merged);
    this.onDataProgress(end, this.length);
  }
}

export function previewPdfRequestKey(
  snapshot: PreviewSnapshot | null,
  source: PreviewSourceProjection | null,
  representation: PdfRepresentation | null
) {
  if (snapshot === null || source === null || representation === null) return null;
  const envelope = snapshot.representation;
  if (envelope === undefined) return null;
  return [
    snapshot.previewId,
    snapshot.sessionId,
    snapshot.requestId,
    source.key,
    snapshot.sourceVersion ?? envelope.sourceVersion,
    representation.assetToken,
    representation.mediaType,
    representation.lengthBytes
  ].join("\u001f");
}

export function PdfPreviewRenderer({
  representation,
  envelope,
  snapshot,
  source,
  t,
  requestPreviewAsset,
  onPdfPresentationState
}: {
  representation: PdfRepresentation;
  envelope: PreviewRepresentationEnvelope;
  snapshot: PreviewSnapshot;
  source: NonNullable<PreviewExperienceState["source"]>;
  t: ReturnType<typeof useI18nContext>["t"];
  requestPreviewAsset?: PreviewAssetRequestHandler;
  onPdfPresentationState?: PdfPreviewPresentationHandler;
}) {
  const sourceVersion = snapshot.sourceVersion ?? envelope.sourceVersion;
  const requestKey = previewPdfRequestKey(snapshot, source, representation);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<PdfStatus>("loading");
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scaleMode, setScaleMode] = useState<PdfScaleMode>("fit-width");
  const [zoom, setZoom] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let active = true;
    let terminalStatus: Exclude<PdfStatus, "loading" | "ready" | "stale"> | null = null;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let loadedDocument: PDFDocumentProxy | null = null;
    let rangeTransport: PreviewPdfRangeTransport | null = null;
    setStatus("loading");
    setDocumentProxy(null);
    setCurrentPage(1);
    setTotalPages(0);

    const settleTerminal = (next: Exclude<PdfStatus, "loading" | "ready" | "stale">) => {
      if (!active || terminalStatus !== null) return;
      terminalStatus = next;
      setStatus(next);
    };

    if (requestKey === null || requestPreviewAsset === undefined || !Number.isSafeInteger(representation.lengthBytes)) {
      settleTerminal("failed");
      return () => {
        active = false;
      };
    }

    const request: Omit<PreviewAssetRequest, "offsetBytes" | "maxBytes"> = {
      previewId: snapshot.previewId,
      requestId: snapshot.requestId,
      sourceVersion,
      assetToken: representation.assetToken
    };

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const transport = new PreviewPdfRangeTransport(
          representation.lengthBytes,
          request,
          requestPreviewAsset,
          source.displayName
        );
        rangeTransport = transport;
        const documentInit = {
          range: transport,
          length: representation.lengthBytes,
          rangeChunkSize: PDF_RANGE_CHUNK_BYTES,
          useWorkerFetch: false,
          disableStream: true,
          disableAutoFetch: true,
          enableScripting: false,
          isEvalSupported: false
        } as Parameters<typeof pdfjs.getDocument>[0] & { enableScripting: false };
        loadingTask = pdfjs.getDocument(documentInit);
        const task = loadingTask;
        transport.setErrorHandler(() => {
          settleTerminal("failed");
          transport.abort();
          void task.destroy().catch(() => undefined);
        });
        // PDF.js exposes the password callback on the loading task. Keeping it
        // out of getDocument's init object avoids a version-dependent no-op.
        task.onPassword = (_setPassword: (password: string) => void, _reason: number) => {
          settleTerminal("encrypted");
          transport.abort();
          void task.destroy().catch(() => undefined);
        };
        loadedDocument = await task.promise;
        if (!active || terminalStatus !== null) {
          void loadedDocument.destroy();
          return;
        }
        setTotalPages(loadedDocument.numPages);
        setDocumentProxy(loadedDocument);
        setStatus("ready");
      } catch (error: unknown) {
        if (!active || terminalStatus !== null) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "PasswordException" || name === "PasswordResponses") {
          settleTerminal("encrypted");
        } else if (name === "InvalidPDFException" || name === "MissingPDFException") {
          settleTerminal("corrupt");
        } else if (name === "AbortException") {
          settleTerminal("cancelled");
        } else {
          settleTerminal("failed");
        }
      }
    })();

    return () => {
      active = false;
      rangeTransport?.abort();
      if (terminalStatus === null) setStatus("stale");
      void loadingTask?.destroy().catch(() => undefined);
      if (loadedDocument !== null) void loadedDocument.destroy();
    };
  }, [representation.assetToken, representation.lengthBytes, representation.mediaType, requestKey, requestPreviewAsset, snapshot.previewId, snapshot.requestId, source.displayName, sourceVersion]);

  useEffect(() => {
    if (requestKey === null || onPdfPresentationState === undefined) return;
    const state: PreviewImagePresentationState = status === "ready" && documentProxy !== null
      ? "ready"
      : status === "failed" || status === "corrupt" || status === "encrypted"
        ? "failed"
        : "loading";
    onPdfPresentationState(requestKey, state);
  }, [documentProxy, onPdfPresentationState, requestKey, status]);

  const pageNumbers = useMemo(() => pdfPageNumbers(totalPages), [totalPages]);

  const updateCurrentPage = useCallback(() => {
    const container = scrollRef.current;
    if (container === null || pageNumbers.length === 0) return;
    const containerTop = container.getBoundingClientRect().top + 12;
    let nearestPage = 1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const pageNumber of pageNumbers) {
      const page = container.querySelector<HTMLElement>(
        "[data-preview-pdf-page=\"" + pageNumber + "\"]"
      );
      if (page === null) continue;
      const rect = page.getBoundingClientRect();
      const distance = Math.abs(rect.top - containerTop);
      if (rect.bottom >= containerTop && distance < nearestDistance) {
        nearestPage = pageNumber;
        nearestDistance = distance;
      }
    }
    setCurrentPage((current) => current === nearestPage ? current : nearestPage);
  }, [pageNumbers]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container === null) return undefined;
    const onScroll = () => updateCurrentPage();
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [updateCurrentPage]);

  function zoomBy(delta: number) {
    setScaleMode("manual");
    setZoom((current) => Math.min(3, Math.max(0.5, Number((current + delta).toFixed(2)))));
  }

  if (status !== "ready" || documentProxy === null) {
    return (
      <div
        className="zc-preview-representation zc-preview-pdf"
        data-preview-representation="pdf"
        data-preview-pdf-status={status}
        role="status"
      >
        <PdfStatusMessage status={status} t={t} />
      </div>
    );
  }

  return (
    <article
      className="zc-preview-representation zc-preview-pdf"
      data-preview-representation="pdf"
      data-preview-pdf-status={status}
      data-preview-pdf-page={currentPage}
      data-preview-pdf-pages={totalPages}
    >
      <div className="zc-preview-pdf-toolbar" role="toolbar" aria-label={t("libraryPreviewPdf")}>
        <div className="zc-preview-pdf-toolbar-group">
          <button
            type="button"
            className="zc-preview-pdf-tool"
            aria-label={t("previewPdfFitWidth")}
            data-preview-pdf-fit="width"
            aria-pressed={scaleMode === "fit-width"}
            onClick={() => setScaleMode("fit-width")}
          >
            {t("previewPdfFitWidth")}
          </button>
          <button
            type="button"
            className="zc-preview-pdf-tool"
            aria-label={t("previewPdfFitPage")}
            data-preview-pdf-fit="page"
            aria-pressed={scaleMode === "fit-page"}
            onClick={() => setScaleMode("fit-page")}
          >
            {t("previewPdfFitPage")}
          </button>
        </div>
        <div className="zc-preview-pdf-toolbar-group">
          <button type="button" className="zc-preview-pdf-icon-tool" aria-label={t("previewPdfZoomOut")} onClick={() => zoomBy(-0.1)}>
            <Minus size={14} aria-hidden="true" />
          </button>
          <span data-preview-pdf-zoom>{Math.round((scaleMode === "manual" ? zoom : 1) * 100)}%</span>
          <button type="button" className="zc-preview-pdf-icon-tool" aria-label={t("previewPdfZoomIn")} onClick={() => zoomBy(0.1)}>
            <Plus size={14} aria-hidden="true" />
          </button>
          <button type="button" className="zc-preview-pdf-icon-tool" aria-label={t("previewPdfResetZoom")} onClick={() => { setScaleMode("fit-width"); setZoom(1); }}>
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <span className="zc-preview-pdf-page-count" data-preview-pdf-page-indicator>
            {t("previewPdfPage").replace("{page}", String(currentPage)).replace("{pages}", String(totalPages))}
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="zc-preview-pdf-scroll"
        data-preview-pdf-scroll="true"
        tabIndex={0}
        aria-label={t("libraryPreviewPdf")}
        onScroll={updateCurrentPage}
      >
        {pageNumbers.map((pageNumber) => (
          <PdfPageCanvas
            key={requestKey + "-" + pageNumber}
            documentProxy={documentProxy}
            pageNumber={pageNumber}
            scaleMode={scaleMode}
            zoom={zoom}
            scrollContainerRef={scrollRef}
            pageErrorLabel={t("previewPdfPageFailed")}
          />
        ))}
      </div>
    </article>
  );
}

function PdfPageCanvas({
  documentProxy,
  pageNumber,
  scaleMode,
  zoom,
  scrollContainerRef,
  pageErrorLabel
}: {
  documentProxy: PDFDocumentProxy;
  pageNumber: number;
  scaleMode: PdfScaleMode;
  zoom: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pageErrorLabel: string;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [baseViewport, setBaseViewport] = useState<PageViewport | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [nearViewport, setNearViewport] = useState(false);
  const [failed, setFailed] = useState(false);
  const [renderState, setRenderState] = useState<"deferred" | "loading" | "rendering" | "rendered" | "failed">("deferred");

  useEffect(() => {
    const element = pageRef.current;
    const container = scrollContainerRef.current;
    if (element === null) return undefined;
    const updateFromGeometry = () => {
      const elementRect = element.getBoundingClientRect();
      const rootRect = container?.getBoundingClientRect();
      const top = rootRect?.top ?? 0;
      const bottom = rootRect?.bottom ?? window.innerHeight;
      const nextNear = elementRect.bottom >= top - 800 && elementRect.top <= bottom + 800;
      setNearViewport(nextNear);
    };
    if (typeof IntersectionObserver !== "function" || container === null) {
      updateFromGeometry();
      const target = container ?? window;
      target.addEventListener("scroll", updateFromGeometry, { passive: true });
      window.addEventListener("resize", updateFromGeometry);
      return () => {
        target.removeEventListener("scroll", updateFromGeometry);
        window.removeEventListener("resize", updateFromGeometry);
      };
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setNearViewport(entry.isIntersecting);
    }, { root: container, rootMargin: PDF_NEARBY_ROOT_MARGIN, threshold: [0, 0.2] });
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNumber, scrollContainerRef]);

  useEffect(() => {
    let active = true;
    setPage(null);
    setBaseViewport(null);
    setFailed(false);
    setRenderState(nearViewport ? "loading" : "deferred");
    if (!nearViewport) return () => {
      active = false;
    };
    void documentProxy.getPage(pageNumber).then((nextPage) => {
      if (!active) {
        nextPage.cleanup();
        return;
      }
      setPage(nextPage);
      setBaseViewport(nextPage.getViewport({ scale: 1 }));
      setRenderState("loading");
    }).catch(() => {
      if (active) {
        setFailed(true);
        setRenderState("failed");
      }
    });
    return () => {
      active = false;
    };
  }, [documentProxy, nearViewport, pageNumber]);

  // PDF.js keeps page resources and operator lists alive until cleanup. A
  // page leaving the nearby window must release them even when no render task
  // was started for it.
  useEffect(() => () => {
    page?.cleanup();
  }, [page]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container === null) return undefined;
    const updateSize = () => {
      setContainerWidth(container.clientWidth);
      setContainerHeight(container.clientHeight);
    };
    updateSize();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  const scale = baseViewport === null
    ? 1
    : scaleMode === "fit-page"
      ? clampScale(Math.min(
        (containerWidth - 32) / baseViewport.width,
        (containerHeight - 32) / baseViewport.height
      ))
      : scaleMode === "manual"
        ? zoom
        : clampScale((containerWidth - 32) / baseViewport.width);
  const viewport = useMemo(
    () => baseViewport === null || page === null ? null : page.getViewport({ scale }),
    [baseViewport, page, scale]
  );
  const pageStyle: CSSProperties = {
    minHeight: viewport?.height ?? PDF_ESTIMATED_PAGE_HEIGHT
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!nearViewport || page === null || viewport === null || canvas === null) return undefined;
    const context = canvas.getContext("2d");
    if (context === null) {
      setFailed(true);
      setRenderState("failed");
      return undefined;
    }
    setFailed(false);
    setRenderState("rendering");
    const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const renderTask = page.render({ canvasContext: context, viewport });
    let active = true;
    void renderTask.promise.then(() => {
      if (active) setRenderState("rendered");
    }).catch(() => {
      if (active) {
        setFailed(true);
        setRenderState("failed");
      }
    });
    return () => {
      active = false;
      renderTask.cancel();
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = "";
      canvas.style.height = "";
    };
  }, [nearViewport, page, viewport]);

  const pageState = failed || renderState === "failed"
    ? "failed"
    : !nearViewport
      ? "deferred"
      : renderState;

  return (
    <div
      ref={pageRef}
      className="zc-preview-pdf-page"
      style={pageStyle}
      data-preview-pdf-page={pageNumber}
      data-preview-pdf-page-state={pageState}
    >
      {failed ? <span className="zc-preview-pdf-page-error" role="status">{pageErrorLabel}</span> : null}
      {nearViewport ? <canvas ref={canvasRef} aria-label={"PDF page " + pageNumber} /> : null}
    </div>
  );
}

function PdfStatusMessage({ status, t }: { status: PdfStatus; t: ReturnType<typeof useI18nContext>["t"] }) {
  const title = status === "encrypted"
    ? t("previewPdfEncrypted")
    : status === "corrupt"
      ? t("previewPdfCorrupt")
      : status === "cancelled"
        ? t("previewCancelled")
        : status === "stale"
          ? t("previewCancelled")
          : status === "failed"
            ? t("previewPdfFailed")
            : t("previewLoading");
  const description = status === "encrypted" || status === "corrupt" || status === "failed"
    ? t("previewPdfFailedDescription")
    : t("previewLoading");
  return (
    <div className="zc-quick-preview-status is-terminal" data-preview-pdf-message={status}>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function clampScale(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(3, Math.max(0.4, value));
}
