import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
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
type PdfViewport = { width: number; height: number; [key: string]: unknown };
type PdfRenderTask = { promise: Promise<unknown>; cancel?: () => void };
type PdfPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask;
  cleanup?: () => void;
};
type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void> | void;
};
type PdfLoadingTask = {
  promise: Promise<PdfDocument>;
  destroy?: () => Promise<void> | void;
};
type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: {
    data: Uint8Array;
    useWorkerFetch: boolean;
    isEvalSupported: boolean;
    onPassword?: () => void;
  }) => PdfLoadingTask;
};

type PdfStatus = "loading" | "ready" | "failed" | "corrupt" | "encrypted" | "cancelled" | "stale";
type PdfScaleMode = "fit-width" | "fit-page" | "manual";

export type PdfPreviewPresentationHandler = (
  requestKey: string,
  state: PreviewImagePresentationState
) => void;

const MAX_RENDERED_PDF_PAGES = 128;
const PDF_MEDIA_TYPE = "application/pdf";

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
    representation.mediaType
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
  const [documentProxy, setDocumentProxy] = useState<PdfDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scaleMode, setScaleMode] = useState<PdfScaleMode>("fit-width");
  const [zoom, setZoom] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let active = true;
    let loadingTask: PdfLoadingTask | null = null;
    let loadedDocument: PdfDocument | null = null;
    setStatus("loading");
    setDocumentProxy(null);
    setCurrentPage(1);
    setTotalPages(0);

    if (requestKey === null || requestPreviewAsset === undefined) {
      setStatus("failed");
      return () => {
        active = false;
      };
    }

    const request: PreviewAssetRequest = {
      previewId: snapshot.previewId,
      requestId: snapshot.requestId,
      sourceVersion,
      assetToken: representation.assetToken
    };

    void requestPreviewAsset(request)
      .then(async (artifact) => {
        if (!active) return;
        if (artifact.mediaType.toLowerCase() !== PDF_MEDIA_TYPE
          || representation.mediaType.toLowerCase() !== PDF_MEDIA_TYPE) {
          setStatus("failed");
          return;
        }
        const copiedBytes = new Uint8Array(artifact.bytes.byteLength);
        copiedBytes.set(artifact.bytes);
        const pdfjs = await import("pdfjs-dist") as unknown as PdfJsModule;
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument({
          data: copiedBytes,
          useWorkerFetch: false,
          isEvalSupported: false,
          onPassword: () => {
            if (!active) return;
            setStatus("encrypted");
            void loadingTask?.destroy?.();
          }
        });
        loadedDocument = await loadingTask.promise;
        if (!active) {
          void loadedDocument.destroy();
          return;
        }
        setTotalPages(loadedDocument.numPages);
        setDocumentProxy(loadedDocument);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "PasswordException" || name === "PasswordResponses") {
          setStatus("encrypted");
        } else if (name === "InvalidPDFException" || name === "MissingPDFException") {
          setStatus("corrupt");
        } else {
          setStatus("failed");
        }
      });

    return () => {
      active = false;
      setStatus("stale");
      void loadingTask?.destroy?.();
      if (loadedDocument !== null) void loadedDocument.destroy();
    };
  }, [representation.assetToken, representation.mediaType, requestKey, requestPreviewAsset, snapshot.previewId, snapshot.requestId, sourceVersion]);

  useEffect(() => {
    if (requestKey === null || onPdfPresentationState === undefined) return;
    const state: PreviewImagePresentationState = status === "ready" && documentProxy !== null
      ? "ready"
      : status === "failed" || status === "corrupt" || status === "encrypted"
        ? "failed"
        : "loading";
    onPdfPresentationState(requestKey, state);
  }, [documentProxy, onPdfPresentationState, requestKey, status]);

  const visiblePageCount = Math.min(totalPages, MAX_RENDERED_PDF_PAGES);
  const pageNumbers = useMemo(
    () => Array.from({ length: visiblePageCount }, (_, index) => index + 1),
    [visiblePageCount]
  );

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
            onVisible={setCurrentPage}
            pageErrorLabel={t("previewPdfPageFailed")}
          />
        ))}
        {totalPages > MAX_RENDERED_PDF_PAGES ? (
          <p className="zc-preview-pdf-limit" role="status">{t("previewPdfPageLimit")}</p>
        ) : null}
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
  onVisible,
  pageErrorLabel
}: {
  documentProxy: PdfDocument;
  pageNumber: number;
  scaleMode: PdfScaleMode;
  zoom: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onVisible: (pageNumber: number) => void;
  pageErrorLabel: string;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [page, setPage] = useState<PdfPage | null>(null);
  const [baseViewport, setBaseViewport] = useState<PdfViewport | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setPage(null);
    setBaseViewport(null);
    setFailed(false);
    void documentProxy.getPage(pageNumber).then((nextPage) => {
      if (!active) {
        nextPage.cleanup?.();
        return;
      }
      setPage(nextPage);
      setBaseViewport(nextPage.getViewport({ scale: 1 }));
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [documentProxy, pageNumber]);

  useEffect(() => {
    const element = pageRef.current;
    const container = scrollContainerRef.current;
    if (element === null) return undefined;
    const show = () => {
      setVisible(true);
      onVisible(pageNumber);
    };
    if (typeof IntersectionObserver !== "function" || container === null) {
      show();
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) onVisible(pageNumber);
    }, { root: container, rootMargin: "480px 0px", threshold: [0, 0.2] });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible, pageNumber, scrollContainerRef]);

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
  const viewport = baseViewport === null ? null : page?.getViewport({ scale }) ?? null;
  const pageStyle: CSSProperties = viewport === null ? {} : { minHeight: viewport.height };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || page === null || viewport === null || canvas === null) return undefined;
    const context = canvas.getContext("2d");
    if (context === null) {
      setFailed(true);
      return undefined;
    }
    const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const renderTask = page.render({
      canvasContext: context,
      viewport
    });
    let active = true;
    void renderTask.promise.catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      renderTask.cancel?.();
      page.cleanup?.();
    };
  }, [page, scale, viewport, visible]);

  return (
    <div
      ref={pageRef}
      className="zc-preview-pdf-page"
      style={pageStyle}
      data-preview-pdf-page={pageNumber}
      data-preview-pdf-page-state={failed ? "failed" : visible ? "visible" : "deferred"}
    >
      {failed ? <span className="zc-preview-pdf-page-error" role="status">{pageErrorLabel}</span> : null}
      <canvas ref={canvasRef} aria-label={"PDF page " + pageNumber} />
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
    <div className="zc-floating-preview-status is-terminal" data-preview-pdf-message={status}>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function clampScale(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(3, Math.max(0.4, value));
}
