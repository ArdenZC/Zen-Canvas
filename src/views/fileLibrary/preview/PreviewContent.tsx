import { File, Folder, LoaderCircle } from "lucide-react";
import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PreviewMetadata, PreviewSnapshot } from "../../../types/fileWorkspace";
import type {
  PreviewAssetArtifact,
  PreviewAssetRequest,
  PreviewNativePresentation,
  PreviewRepresentation
} from "../../../types/fileWorkspace";
import { formatBytes, formatDate } from "../../../utils/format";
import { useI18nContext } from "../../../contexts/AppContexts";
import {
  parseFolderSummaryPayload,
  type FolderSummaryPayloadV1
} from "../../../api/folderPreviewWire";
import {
  previewFallbackState,
  type PreviewExperiencePhase,
  type PreviewExperienceState,
  type PreviewImagePresentationState
} from "./previewExperienceController";
import {
  parseArchiveTreePayload,
  parseStructuredTreePayload,
  parseTablePayload,
  type ArchiveNodeV1,
  type ArchiveTreePayloadV1,
  type StructuredNodeV1,
  type StructuredTreePayloadV1,
  type TablePayloadV1
} from "../../../api/previewPayloadWire";

type PreviewAssetRequestHandler = (request: PreviewAssetRequest) => Promise<PreviewAssetArtifact>;
type NativePreviewGeometryHandler = (
  previewId: string,
  presentation: PreviewNativePresentation
) => Promise<PreviewSnapshot | null>;

type ImageAssetFailure = "unavailable" | "unsupported" | "failed";
export type PreviewImagePresentationHandler = (
  requestKey: string,
  state: PreviewImagePresentationState
) => void;

export function previewImageRequestKey(
  snapshot: PreviewSnapshot | null,
  source: PreviewExperienceState["source"]
) {
  const envelope = snapshot?.representation;
  const representation = envelope?.representation;
  if (snapshot === null || source === null || envelope === undefined || representation?.family !== "image") return null;
  const sourceVersion = snapshot.sourceVersion ?? envelope.sourceVersion;
  return [
    snapshot.previewId,
    snapshot.sessionId,
    snapshot.requestId,
    source.key,
    sourceVersion,
    representation.assetToken,
    representation.mediaType
  ].join("\u001f");
}

export function usePreviewImagePresentation(
  snapshot: PreviewSnapshot | null,
  source: PreviewExperienceState["source"]
) {
  const requestKey = previewImageRequestKey(snapshot, source);
  const [presentation, setPresentation] = useState<{
    key: string;
    state: PreviewImagePresentationState;
  } | null>(null);

  useEffect(() => {
    setPresentation((current) => current?.key === requestKey ? current : null);
  }, [requestKey]);

  const publish = useCallback<PreviewImagePresentationHandler>((key, state) => {
    setPresentation((current) => current?.key === key && current.state === state
      ? current
      : { key, state });
  }, []);

  return {
    requestKey,
    state: presentation?.key === requestKey ? presentation.state : null,
    publish
  };
}

export function renderPreviewBody(
  phase: PreviewExperiencePhase,
  source: PreviewExperienceState["source"],
  metadata: PreviewMetadata | null,
  language: Parameters<typeof formatDate>[1],
  t: ReturnType<typeof useI18nContext>["t"],
  snapshot: PreviewSnapshot | null = null,
  requestPreviewAsset?: PreviewAssetRequestHandler,
  updateNativePreviewGeometry?: NativePreviewGeometryHandler,
  onImagePresentationState?: PreviewImagePresentationHandler
) {
  if (source === null || phase === "no_source") {
    return (
      <div className="zc-floating-preview-status is-terminal" data-preview-no-source="true">
        <strong>{t("previewSelectItem")}</strong>
        <span>{t("previewSelectItemDescription")}</span>
      </div>
    );
  }

  if (phase === "resolving" || phase === "loading") {
    return <div className="zc-floating-preview-status" data-preview-progress="true"><LoaderCircle className="animate-spin" size={22} aria-hidden="true" /><span>{phase === "resolving" ? t("previewResolving") : t("previewLoading")}</span></div>;
  }

  if (phase === "content") {
    const envelope = snapshot?.representation;
    const representation = envelope?.representation;
    if (envelope === undefined || representation === undefined) {
      return <PreviewStatus
        state="failed"
        title={t("previewContentFailed")}
        description={t("previewContentFailedDescription")}
      />;
    }
    if (representation.family === "text") {
      return (
        <article
          className="zc-preview-representation zc-preview-text"
          data-preview-representation="text"
          data-preview-completeness={envelope.completeness}
          data-preview-degraded={envelope.completeness === "complete" ? "false" : "true"}
          data-preview-selectable={envelope.capabilities.canSelectText ? "true" : "false"}
        >
          <div className="zc-preview-representation-meta">
            <span>{representation.language ?? t("previewTextContent")}</span>
            {envelope.completeness !== "complete" ? <span data-preview-partial="true">{t("previewPartialContent")}</span> : null}
          </div>
          <pre className="zc-preview-text-value">{representation.text}</pre>
        </article>
      );
    }
    if (representation.family === "safe_html") {
      return (
        <article
          className="zc-preview-representation zc-preview-safe-html"
          data-preview-representation="safe_html"
          data-preview-completeness={envelope.completeness}
          data-preview-degraded={envelope.completeness === "complete" ? "false" : "true"}
          data-preview-selectable={envelope.capabilities.canSelectText ? "true" : "false"}
        >
          <div className="zc-preview-representation-meta">
            <span>{t("previewMarkdownContent")}</span>
            {envelope.completeness !== "complete" ? <span data-preview-partial="true">{t("previewPartialContent")}</span> : null}
          </div>
          <div className="zc-preview-safe-html-root" dangerouslySetInnerHTML={{ __html: representation.html }} />
        </article>
      );
    }
    if (representation.family === "structured_tree") {
      try {
        return (
          <StructuredTreeRepresentation
            payload={parseStructuredTreePayload(representation.encodedTree)}
            completeness={envelope.completeness}
            selectable={envelope.capabilities.canSelectText}
            t={t}
          />
        );
      } catch {
        return <InvalidPayloadState t={t} />;
      }
    }
    if (representation.family === "table") {
      try {
        return (
          <TableRepresentation
            payload={parseTablePayload(representation.encodedTable)}
            completeness={envelope.completeness}
            selectable={envelope.capabilities.canSelectText}
            t={t}
          />
        );
      } catch {
        return <InvalidPayloadState t={t} />;
      }
    }
    if (representation.family === "archive_tree") {
      try {
        return (
          <ArchiveTreeRepresentation
            payload={parseArchiveTreePayload(representation.encodedTree)}
            completeness={envelope.completeness}
            t={t}
          />
        );
      } catch {
        return <InvalidPayloadState t={t} />;
      }
    }
    if (representation.family === "folder_summary") {
      try {
        return (
          <FolderSummaryRepresentation
            payload={parseFolderSummaryPayload(representation.encodedSummary)}
            completeness={envelope.completeness}
            t={t}
          />
        );
      } catch {
        return <InvalidPayloadState t={t} />;
      }
    }
    if (representation.family === "image") {
      return (
        <ImageRepresentation
          representation={representation}
          envelope={envelope}
          snapshot={snapshot}
          source={source}
          t={t}
          requestPreviewAsset={requestPreviewAsset}
          onImagePresentationState={onImagePresentationState}
        />
      );
    }
    if (representation.family === "native_opaque" && snapshot !== null) {
      return (
        <NativeOpaqueRepresentation
          representation={representation}
          envelope={envelope}
          snapshot={snapshot}
          t={t}
          updateNativePreviewGeometry={updateNativePreviewGeometry}
        />
      );
    }
    return <PreviewStatus
      state="unsupported"
      title={t("previewUnsupportedRepresentation")}
      description={t("previewUnsupportedRepresentationDirectDescription")}
    />;
  }

  if (phase !== "metadata_fallback" && phase !== "unsupported_representation" && phase !== "closed") {
    return <div className="zc-floating-preview-status is-terminal" data-preview-terminal-state={phase}><strong>{terminalTitle(phase, t)}</strong><span>{terminalDescription(phase, t)}</span></div>;
  }

  if (phase === "unsupported_representation") {
    return <PreviewStatus
      state="unsupported"
      title={t("previewUnsupportedRepresentation")}
      description={t("previewUnsupportedRepresentationDirectDescription")}
    />;
  }

  const fallbackState = previewFallbackState(snapshot);
  const fallbackTitle = fallbackState === "failed"
    ? t("previewContentFailed")
    : fallbackState === "unsupported"
      ? t("previewUnsupportedRepresentation")
      : t("previewMetadataFallback");
  const fallbackDescription = fallbackState === "failed"
    ? t("previewContentFailedDescription")
    : fallbackState === "unsupported"
      ? t("previewUnsupportedRepresentationDescription")
      : t("previewMetadataOnlyDescription");
  return (
    <div
      className="zc-floating-preview-metadata"
      data-preview-metadata="true"
      data-preview-fallback-state={fallbackState ?? "metadata"}
      data-preview-content-state={fallbackState === "failed" ? "failed" : fallbackState === "unsupported" ? "unsupported" : "metadata_fallback"}
    >
      <div className="zc-floating-preview-entry-icon" aria-hidden="true">
        {source.entryKind === "directory" ? <Folder size={24} /> : <File size={24} />}
      </div>
      <div className="zc-floating-preview-fallback-note">
        <strong>{fallbackTitle}</strong>
        <span>{fallbackDescription}</span>
      </div>
      <dl className="zc-floating-preview-facts">
        <PreviewFact label={t("fileType")} value={metadata?.mediaType ?? source.typeHint ?? t("browseUnknownValue")} />
        <PreviewFact label={t("fileSize")} value={metadata?.sizeBytes === null || metadata?.sizeBytes === undefined ? source.size === undefined ? t("browseUnknownValue") : formatBytes(source.size) : formatBytes(metadata.sizeBytes)} />
        <PreviewFact label={t("fileModified")} value={metadata?.modifiedAtEpochMs === null || metadata?.modifiedAtEpochMs === undefined ? source.modifiedAt === undefined ? t("browseUnknownValue") : formatDate(String(source.modifiedAt), language) : formatDate(String(metadata.modifiedAtEpochMs), language)} />
        <PreviewFact label={t("previewMaterializationLabel")} value={metadata?.materialization ?? source.materialization ?? t("browseUnknownValue")} />
      </dl>
    </div>
  );
}

function NativeOpaqueRepresentation({
  representation,
  envelope,
  snapshot,
  t,
  updateNativePreviewGeometry
}: {
  representation: Extract<PreviewRepresentation, { family: "native_opaque" }>;
  envelope: NonNullable<PreviewSnapshot["representation"]>;
  snapshot: PreviewSnapshot;
  t: ReturnType<typeof useI18nContext>["t"];
  updateNativePreviewGeometry?: NativePreviewGeometryHandler;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastBoundsKey = useRef<string | null>(null);
  const failedIdentity = useRef<string | null>(null);
  const [nativeBindFailed, setNativeBindFailed] = useState(false);
  const sourceVersion = snapshot.sourceVersion ?? envelope.sourceVersion;
  const identity = [snapshot.previewId, snapshot.sessionId, snapshot.requestId, sourceVersion, representation.host, representation.token].join("\u001f");

  useEffect(() => {
    if (failedIdentity.current === identity) return;
    failedIdentity.current = null;
    lastBoundsKey.current = null;
    setNativeBindFailed(false);
  }, [identity]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (element === null || updateNativePreviewGeometry === undefined) return undefined;
    if (failedIdentity.current === identity) return undefined;
    let frame: number | null = null;
    let active = true;

    const publishGeometry = () => {
      frame = null;
      if (!active) return;
      const rect = element.getBoundingClientRect();
      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const boundsKey = `${identity}:${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
      if (lastBoundsKey.current === boundsKey) return;
      lastBoundsKey.current = boundsKey;
      void updateNativePreviewGeometry(snapshot.previewId, {
        host: representation.host,
        token: representation.token,
        sourceVersion,
        bounds
      }).catch(() => {
        if (active && (failedIdentity.current === null || failedIdentity.current === identity)) {
          failedIdentity.current = identity;
          setNativeBindFailed(true);
        }
      });
    };
    const scheduleGeometry = () => {
      if (frame !== null) return;
      if (typeof requestAnimationFrame === "function") {
        frame = requestAnimationFrame(publishGeometry);
      } else {
        publishGeometry();
      }
    };

    publishGeometry();
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(scheduleGeometry)
      : null;
    observer?.observe(element);
    window.addEventListener("resize", scheduleGeometry);
    window.addEventListener("scroll", scheduleGeometry, true);
    return () => {
      active = false;
      if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleGeometry);
      window.removeEventListener("scroll", scheduleGeometry, true);
    };
  }, [identity, representation.host, representation.token, snapshot.previewId, sourceVersion, updateNativePreviewGeometry]);

  if (nativeBindFailed && failedIdentity.current === identity) {
    return (
      <div className="zc-floating-preview-status is-terminal" data-preview-native-state="unavailable" role="status">
        <strong>{t("previewError")}</strong>
        <span>{t("previewErrorDescription")}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="zc-preview-representation zc-preview-native-opaque"
      data-preview-representation="native_opaque"
      data-preview-native-host={representation.host}
      role="region"
      aria-label={t("previewTextContent")}
    />
  );
}

function InvalidPayloadState({ t }: { t: ReturnType<typeof useI18nContext>["t"] }) {
  return <PreviewStatus
    state="failed"
    title={t("previewContentFailed")}
    description={t("previewContentFailedDescription")}
    dataPayloadInvalid="true"
  />;
}

function PreviewStatus({
  state,
  title,
  description,
  dataPayloadInvalid
}: {
  state: "failed" | "unsupported";
  title: string;
  description: string;
  dataPayloadInvalid?: string;
}) {
  return (
    <div
      className="zc-floating-preview-status is-terminal"
      data-preview-terminal-state={state}
      data-preview-content-state={state}
      data-preview-payload-invalid={dataPayloadInvalid}
      role="status"
    >
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function ImageRepresentation({
  representation,
  envelope,
  snapshot,
  source,
  t,
  requestPreviewAsset,
  onImagePresentationState
}: {
  representation: Extract<PreviewRepresentation, { family: "image" }>;
  envelope: NonNullable<PreviewSnapshot["representation"]>;
  snapshot: PreviewSnapshot | null;
  source: NonNullable<PreviewExperienceState["source"]>;
  t: ReturnType<typeof useI18nContext>["t"];
  requestPreviewAsset?: PreviewAssetRequestHandler;
  onImagePresentationState?: PreviewImagePresentationHandler;
}) {
  const sourceVersion = snapshot?.sourceVersion ?? envelope.sourceVersion;
  const requestKey = previewImageRequestKey(snapshot, source);
  const objectUrlRef = useRef<string | null>(null);
  const [asset, setAsset] = useState<{
    key: string | null;
    status: "loading" | "ready" | "failed";
    url: string | null;
    failure?: ImageAssetFailure;
  }>({
    key: null,
    status: "loading",
    url: null
  });

  useEffect(() => {
    let active = true;
    let preloader: HTMLImageElement | null = null;
    const revokeCurrent = () => {
      const current = objectUrlRef.current;
      if (current !== null && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(current);
      }
      objectUrlRef.current = null;
    };
    revokeCurrent();
    setAsset({ key: requestKey, status: "loading", url: null, failure: undefined });

    if (requestKey === null || snapshot === null || requestPreviewAsset === undefined
      || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      setAsset({ key: requestKey, status: "failed", url: null, failure: "unavailable" });
      return () => {
        active = false;
        revokeCurrent();
      };
    }

    const request: PreviewAssetRequest = {
      previewId: snapshot.previewId,
      requestId: snapshot.requestId,
      sourceVersion,
      assetToken: representation.assetToken
    };
    void requestPreviewAsset(request).then((artifact) => {
      if (!active) return;
      if (!isSupportedImageMediaType(artifact.mediaType)
        || artifact.mediaType !== representation.mediaType) {
        setAsset({ key: requestKey, status: "failed", url: null, failure: "unsupported" });
        return;
      }
      const copiedBytes = new ArrayBuffer(artifact.bytes.byteLength);
      new Uint8Array(copiedBytes).set(artifact.bytes);
      const nextUrl = URL.createObjectURL(new Blob([copiedBytes], { type: artifact.mediaType }));
      if (!active) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      objectUrlRef.current = nextUrl;
      setAsset({ key: requestKey, status: "loading", url: nextUrl, failure: undefined });
      if (typeof Image !== "function") {
        revokeCurrent();
        setAsset({ key: requestKey, status: "failed", url: null, failure: "unavailable" });
        return;
      }
      preloader = new Image();
      preloader.onload = () => {
        if (!active || objectUrlRef.current !== nextUrl) return;
        setAsset({ key: requestKey, status: "ready", url: nextUrl, failure: undefined });
      };
      preloader.onerror = () => {
        if (!active || objectUrlRef.current !== nextUrl) return;
        revokeCurrent();
        setAsset({ key: requestKey, status: "failed", url: null, failure: "failed" });
      };
      preloader.src = nextUrl;
    }).catch(() => {
      if (active) setAsset({ key: requestKey, status: "failed", url: null, failure: "failed" });
    });

    return () => {
      active = false;
      if (preloader !== null) {
        preloader.onload = null;
        preloader.onerror = null;
        preloader.src = "";
      }
      revokeCurrent();
    };
  }, [
    requestKey,
    requestPreviewAsset,
    representation.assetToken,
    representation.mediaType,
    snapshot?.previewId,
    snapshot?.requestId,
    snapshot?.sessionId,
    sourceVersion
  ]);

  useEffect(() => {
    if (requestKey === null || onImagePresentationState === undefined) return;
    const state: PreviewImagePresentationState = asset.key !== requestKey
      ? "loading"
      : asset.status === "failed"
        ? asset.failure ?? "failed"
        : asset.status;
    onImagePresentationState(requestKey, state);
  }, [asset.failure, asset.key, asset.status, onImagePresentationState, requestKey]);

  const partial = envelope.completeness !== "complete";
  const alt = safeImageAlt(source.displayName, t);
  const displayedAsset = asset.key === requestKey
    ? asset
    : { key: requestKey, status: "loading" as const, url: null };

  const markImageFailure = (failure: ImageAssetFailure) => {
    const failedUrl = displayedAsset.url;
    if (failedUrl !== null && objectUrlRef.current === failedUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(failedUrl);
      objectUrlRef.current = null;
    }
    setAsset({ key: requestKey, status: "failed", url: null, failure });
  };

  const handleImageLoad = (loadedUrl: string) => {
    if (requestKey === null || objectUrlRef.current !== loadedUrl) return;
    setAsset({ key: requestKey, status: "ready", url: loadedUrl, failure: undefined });
  };

  const imageElement = displayedAsset.url === null ? null : (
    <img
      className="zc-preview-image-value"
      src={displayedAsset.url}
      alt={alt}
      onLoad={() => handleImageLoad(displayedAsset.url!)}
      onError={() => markImageFailure("failed")}
    />
  );
  return (
    <article
      className="zc-preview-representation zc-preview-image"
      data-preview-representation="image"
      data-preview-completeness={envelope.completeness}
      data-preview-image-status={displayedAsset.status}
      data-preview-image-failure={displayedAsset.failure}
      data-preview-image-degraded={partial ? "true" : "false"}
      data-preview-selectable="false"
    >
      <div className="zc-preview-representation-meta">
        <span>{t("libraryPreviewImage")}</span>
        {partial ? <span data-preview-partial="true">{t("previewPartialContent")}</span> : null}
      </div>
      {displayedAsset.status === "ready" && displayedAsset.url !== null ? (
        <div className="zc-preview-image-stage">
          {imageElement}
        </div>
      ) : displayedAsset.status === "loading" ? (
        <div className="zc-preview-image-stage" data-preview-image-loading="true">
          <div className="zc-floating-preview-status">
            <LoaderCircle className="animate-spin" size={22} aria-hidden="true" />
            <span>{t("previewLoading")}</span>
          </div>
        </div>
      ) : (
        <ImageFailureState failure={displayedAsset.failure ?? "failed"} t={t} />
      )}
    </article>
  );
}

function ImageFailureState({
  failure,
  t
}: {
  failure: ImageAssetFailure;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  const copy = failure === "unsupported"
    ? { title: t("previewImageUnsupported"), description: t("previewImageUnsupportedDescription") }
    : failure === "unavailable"
      ? { title: t("previewImageUnavailable"), description: t("previewImageUnavailableDescription") }
      : { title: t("previewImageFailed"), description: t("previewImageFailedDescription") };
  return (
    <div
      className="zc-floating-preview-status is-terminal"
      data-preview-image-failed="true"
      data-preview-image-failure={failure}
      role="status"
    >
      <strong>{copy.title}</strong>
      <span>{copy.description}</span>
    </div>
  );
}

function isSupportedImageMediaType(mediaType: string) {
  return mediaType === "image/png" || mediaType === "image/jpeg";
}

function safeImageAlt(displayName: string, t: ReturnType<typeof useI18nContext>["t"]) {
  const value = displayName
    .replace(/[\\/]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 256);
  return value || t("libraryPreviewImage");
}

function StructuredTreeRepresentation({
  payload,
  completeness,
  selectable,
  t
}: {
  payload: StructuredTreePayloadV1;
  completeness: "complete" | "partial" | "unknown";
  selectable: boolean;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  const truncated = payload.truncation.depth || payload.truncation.nodes || payload.truncation.strings;
  const partial = completeness !== "complete" || truncated;
  const truncation = [
    payload.truncation.depth ? "depth" : null,
    payload.truncation.nodes ? "nodes" : null,
    payload.truncation.strings ? "strings" : null
  ].filter((value): value is string => value !== null).join(",");
  return (
    <article
      className="zc-preview-representation zc-preview-structured-tree"
      data-preview-representation="structured_tree"
      data-preview-structured-format={payload.format}
      data-preview-completeness={completeness}
      data-preview-degraded={partial ? "true" : "false"}
      data-preview-truncated={truncated ? "true" : "false"}
      data-preview-truncation={truncation || undefined}
      data-preview-selectable={selectable ? "true" : "false"}
    >
      <div className="zc-preview-representation-meta">
        <span>{t("previewStructuredContent")} · {payload.format.toUpperCase()}</span>
        {partial ? <span data-preview-partial="true">{t("previewPartialContent")}</span> : null}
      </div>
      <div className="zc-preview-structured-tree-root" data-preview-tree-root="true">
        <StructuredNodeView node={payload.root} t={t} />
      </div>
    </article>
  );
}

function StructuredNodeView({
  node,
  t
}: {
  node: StructuredNodeV1;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  switch (node.kind) {
    case "object":
      return (
        <div className="zc-preview-tree-node zc-preview-tree-object" data-preview-node-kind="object">
          <span className="zc-preview-tree-kind">{t("previewObjectLabel")}</span>
          <div className="zc-preview-tree-children">
            {node.entries.map((entry, index) => (
              <div className="zc-preview-tree-entry" data-preview-tree-key={entry.key} key={`${entry.key}-${index}`}>
                <span className="zc-preview-tree-key">{entry.key}</span>
                <StructuredNodeView node={entry.value} t={t} />
              </div>
            ))}
          </div>
        </div>
      );
    case "array":
      return (
        <div className="zc-preview-tree-node zc-preview-tree-array" data-preview-node-kind="array">
          <span className="zc-preview-tree-kind">{t("previewArrayLabel")}</span>
          <div className="zc-preview-tree-children">
            {node.items.map((item, index) => (
              <div className="zc-preview-tree-entry" data-preview-tree-index={index} key={index}>
                <span className="zc-preview-tree-key">[{index}]</span>
                <StructuredNodeView node={item} t={t} />
              </div>
            ))}
          </div>
        </div>
      );
    case "scalar":
      return <span className="zc-preview-tree-scalar" data-preview-node-kind="scalar" data-preview-scalar-type={node.scalarType}>{node.value}</span>;
    case "element":
      return (
        <div className="zc-preview-tree-node zc-preview-tree-element" data-preview-node-kind="element" data-preview-element-name={node.name}>
          <span className="zc-preview-tree-kind">&lt;{node.name}&gt;</span>
          {node.attributes.length > 0 ? <span className="zc-preview-tree-attributes">{node.attributes.map((attribute) => `${attribute.name}="${attribute.value}"`).join(" ")}</span> : null}
          <div className="zc-preview-tree-children">
            {node.children.map((child, index) => <StructuredNodeView node={child} t={t} key={index} />)}
          </div>
        </div>
      );
    case "text":
      return <span className="zc-preview-tree-text" data-preview-node-kind="text">{node.value}</span>;
  }
}

function TableRepresentation({
  payload,
  completeness,
  selectable,
  t
}: {
  payload: TablePayloadV1;
  completeness: "complete" | "partial" | "unknown";
  selectable: boolean;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  const truncated = payload.truncation.rows || payload.truncation.columns || payload.truncation.cells;
  const partial = completeness !== "complete" || truncated;
  const truncation = [
    payload.truncation.rows ? "rows" : null,
    payload.truncation.columns ? "columns" : null,
    payload.truncation.cells ? "cells" : null
  ].filter((value): value is string => value !== null).join(",");
  const empty = payload.columns.length === 0 && payload.rows.length === 0;
  return (
    <article
      className="zc-preview-representation zc-preview-table"
      data-preview-representation="table"
      data-preview-table-format={payload.format}
      data-preview-completeness={completeness}
      data-preview-degraded={partial ? "true" : "false"}
      data-preview-truncated={truncated ? "true" : "false"}
      data-preview-truncation={truncation || undefined}
      data-preview-table-empty={empty ? "true" : "false"}
      data-preview-selectable={selectable ? "true" : "false"}
    >
      <div className="zc-preview-representation-meta">
        <span>{t("previewTableContent")} · {payload.format.toUpperCase()}</span>
        {partial ? <span data-preview-partial="true">{t("previewPartialContent")}</span> : null}
      </div>
      {empty ? <div className="zc-preview-empty" data-preview-empty="true">{t("previewTableEmpty")}</div> : (
        <div className="zc-preview-table-scroll" data-preview-table-scroll="true">
          <table>
            <caption className="sr-only">{t("previewTableContent")}</caption>
            <thead><tr>{payload.columns.map((column, index) => <th scope="col" key={`${column}-${index}`}>{column}</th>)}</tr></thead>
            <tbody>{payload.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function ArchiveTreeRepresentation({
  payload,
  completeness,
  t
}: {
  payload: ArchiveTreePayloadV1;
  completeness: "complete" | "partial" | "unknown";
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  const truncated = payload.progress.state === "partial";
  const partial = completeness !== "complete" || truncated;
  const inspected = t("previewArchiveInspected").replace("{count}", String(payload.progress.inspectedEntries));
  const observed = t("previewArchiveObserved").replace("{count}", String(payload.totals.entriesObserved));
  return (
    <article
      className="zc-preview-representation zc-preview-archive-tree"
      data-preview-representation="archive_tree"
      data-preview-archive-format={payload.format}
      data-preview-completeness={completeness}
      data-preview-archive-state={payload.progress.state}
      data-preview-degraded={partial ? "true" : "false"}
      data-preview-truncated={truncated ? "true" : "false"}
      data-preview-archive-inspected={payload.progress.inspectedEntries}
      data-preview-archive-observed={payload.totals.entriesObserved}
      data-preview-selectable="false"
    >
      <div className="zc-preview-representation-meta">
        <span>{t("previewArchiveContent")}</span>
        <span data-preview-archive-completeness="true">{partial ? t("previewArchivePartial") : t("previewArchiveComplete")}</span>
        <span>{inspected}</span>
        <span>{observed}</span>
      </div>
      <div className="zc-preview-archive-tree-root" data-preview-archive-tree-root="true">
        <ArchiveNodeView node={payload.root} t={t} isRoot />
      </div>
    </article>
  );
}

function ArchiveNodeView({
  node,
  t,
  isRoot = false
}: {
  node: ArchiveNodeV1;
  t: ReturnType<typeof useI18nContext>["t"];
  isRoot?: boolean;
}) {
  const displayName = isRoot ? t("previewArchiveRoot") : node.name;
  const kindLabel = node.kind === "directory" ? t("previewArchiveDirectory") : t("previewArchiveFile");
  return (
    <div className={`zc-preview-archive-node zc-preview-archive-${node.kind}`} data-preview-archive-kind={node.kind}>
      <div
        className="zc-preview-archive-node-heading"
        data-preview-archive-unsafe={node.unsafeName ? "true" : undefined}
      >
        <span className="zc-preview-archive-kind">{kindLabel}</span>
        <span className="zc-preview-archive-name">{displayName}</span>
        {node.unsafeName ? <span className="zc-preview-archive-unsafe">{t("previewArchiveUnsafeName")}</span> : null}
        {node.kind === "file" ? (
          <span className="zc-preview-archive-metadata">
            {node.compressionMethod ?? ""}
            {node.compressedSize === undefined ? "" : ` · ${formatBytes(node.compressedSize)}`}
            {node.uncompressedSizeDeclared === undefined ? "" : ` · ${formatBytes(node.uncompressedSizeDeclared)}`}
            {node.encrypted ? ` · ${t("previewArchiveEncrypted")}` : ""}
          </span>
        ) : null}
      </div>
      {node.children !== undefined && node.children.length > 0 ? (
        <div className="zc-preview-archive-children">
          {node.children.map((child, index) => <ArchiveNodeView node={child} t={t} key={`${child.name}-${index}`} />)}
        </div>
      ) : null}
    </div>
  );
}

function FolderSummaryRepresentation({
  payload,
  completeness,
  t
}: {
  payload: FolderSummaryPayloadV1;
  completeness: "complete" | "partial" | "unknown";
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  const truncated = payload.progress.state === "partial";
  const partial = completeness !== "complete" || truncated;
  const limitReason = payload.progress.limitReason === "entry_limit"
    ? t("previewFolderLimitEntry")
    : payload.progress.limitReason === "deadline"
    ? t("previewFolderLimitDeadline")
    : null;
  return (
    <article
      className="zc-preview-representation zc-preview-folder-summary"
      data-preview-representation="folder_summary"
      data-preview-completeness={completeness}
      data-preview-folder-state={payload.progress.state}
      data-preview-truncated={truncated ? "true" : "false"}
      data-preview-degraded={partial ? "true" : "false"}
      data-preview-inspected-entries={payload.progress.inspectedEntries}
      data-preview-accepted-children={payload.progress.acceptedChildren}
      data-preview-limit-reason={payload.progress.limitReason ?? "none"}
      data-preview-selectable="false"
    >
      <div className="zc-preview-representation-meta">
        <span>{t("previewFolderContent")} · {payload.folderName || t("previewFolderNoEntries")}</span>
        {partial ? <span data-preview-partial="true">{t("previewFolderPartial")}</span> : <span>{t("previewFolderComplete")}</span>}
      </div>
      <div className="zc-preview-folder-progress" data-preview-folder-progress="true">
        <span>{t("previewFolderInspected")} <strong>{payload.progress.inspectedEntries.toLocaleString()}</strong></span>
        <span>{t("previewFolderAccepted")} <strong>{payload.progress.acceptedChildren.toLocaleString()}</strong></span>
        {limitReason === null ? null : <span data-preview-folder-limit="true">{limitReason}</span>}
      </div>
      <div className="zc-preview-folder-grid">
        <FolderSummaryCard title={t("previewFolderFiles")} value={payload.kindCounts.files} />
        <FolderSummaryCard title={t("previewFolderDirectories")} value={payload.kindCounts.directories} />
        <FolderSummaryCard title={t("previewFolderOther")} value={payload.kindCounts.other} />
        <FolderSummaryCard title={t("previewFolderObservedSize")} value={formatBytes(payload.sizeProgress.observedBytes)} detail={`${payload.sizeProgress.knownSizeEntries.toLocaleString()} ${t("previewFolderKnownSizes")}`} />
      </div>
      <div className="zc-preview-folder-sections">
        <FolderSummaryList title={t("previewFolderExtensions")} empty={t("previewFolderNoEntries")}>
          {payload.extensionCounts.map((bucket) => <li key={bucket.extension}><span>{bucket.extension}</span><strong>{bucket.count.toLocaleString()}</strong></li>)}
        </FolderSummaryList>
        <FolderSummaryList title={t("previewFolderLargestObserved")} empty={t("previewFolderNoEntries")}>
          {payload.largestObserved.map((item) => <li key={`${item.name}-${item.sizeBytes}`}><span>{item.name}</span><strong>{formatBytes(item.sizeBytes)}</strong></li>)}
        </FolderSummaryList>
        <FolderSummaryList title={t("previewFolderProjectHints")} empty={t("previewFolderNoEntries")}>
          {payload.projectHints.map((hint) => <li key={hint}><span>{hint}</span></li>)}
        </FolderSummaryList>
      </div>
      <div className="zc-preview-folder-sample" data-preview-folder-sample="true">
        <h3>{t("previewFolderSample")}</h3>
        {payload.sample.length === 0 ? <p>{t("previewFolderNoEntries")}</p> : (
          <ul>
            {payload.sample.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                <span>{item.kind === "file" && item.sizeBytes !== null ? formatBytes(item.sizeBytes) : item.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function FolderSummaryCard({ title, value, detail }: { title: string; value: number | string; detail?: string }) {
  return (
    <div className="zc-preview-folder-card">
      <span>{title}</span>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      {detail === undefined ? null : <small>{detail}</small>}
    </div>
  );
}

function FolderSummaryList({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return (
    <section className="zc-preview-folder-list">
      <h3>{title}</h3>
      {Children.count(children) === 0 ? <p>{empty}</p> : <ul>{children}</ul>}
    </section>
  );
}

export function metadataFromSnapshot(snapshot: PreviewSnapshot | null) {
  const representation = snapshot?.representation?.representation;
  return representation?.family === "metadata" ? representation.metadata : null;
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return <div className="zc-floating-preview-fact"><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function terminalTitle(phase: PreviewExperiencePhase, t: ReturnType<typeof useI18nContext>["t"]) {
  switch (phase) {
    case "source_unavailable": return t("previewSourceUnavailable");
    case "materialization_required": return t("previewMaterializationRequired");
    case "permission_denied": return t("previewPermissionDenied");
    case "identity_changed": return t("previewIdentityChanged");
    case "cancelled": return t("previewCancelled");
    case "error": return t("previewError");
    default: return t("previewSourceUnavailable");
  }
}

function terminalDescription(phase: PreviewExperiencePhase, t: ReturnType<typeof useI18nContext>["t"]) {
  switch (phase) {
    case "source_unavailable": return t("previewSourceUnavailableDescription");
    case "materialization_required": return t("previewMaterializationRequiredDescription");
    case "permission_denied": return t("previewPermissionDeniedDescription");
    case "identity_changed": return t("previewIdentityChangedDescription");
    case "cancelled": return t("previewCancelledDescription");
    case "error": return t("previewErrorDescription");
    default: return t("previewSourceUnavailableDescription");
  }
}

export function previewStateAnnouncement(
  phase: PreviewExperiencePhase,
  t: ReturnType<typeof useI18nContext>["t"],
  snapshot: PreviewSnapshot | null = null,
  imagePresentationState: PreviewImagePresentationState | null = null
) {
  switch (phase) {
    case "resolving": return t("previewResolving");
    case "loading": return t("previewLoading");
    case "content": {
      if (snapshot?.representation === undefined) return t("previewContentFailed");
      if (snapshot.representation.representation.family === "image") {
        switch (imagePresentationState ?? "loading") {
          case "loading": return t("previewLoading");
          case "ready": return t("previewContentReady");
          case "unavailable": return t("previewImageUnavailable");
          case "unsupported": return t("previewImageUnsupported");
          case "failed": return t("previewImageFailed");
        }
      }
      return snapshot.representation.completeness === "complete"
        ? t("previewContentReady")
        : t("previewPartialContent");
    }
    case "metadata_fallback": {
      const fallback = previewFallbackState(snapshot);
      return fallback === "failed"
        ? t("previewContentFailed")
        : fallback === "unsupported"
          ? t("previewUnsupportedRepresentation")
          : t("previewMetadataFallback");
    }
    case "no_source": return t("previewSelectItem");
    case "unsupported_representation": return t("previewUnsupportedRepresentation");
    case "closed": return "";
    default: return terminalTitle(phase, t);
  }
}
