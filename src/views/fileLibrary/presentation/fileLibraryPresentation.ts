import type { FileRecord } from "../../../types/domain";
import type { Translator } from "../../../types/ui";

/**
 * Presentation-only classification used by shared File Library surfaces.
 * This deliberately preserves the existing Vault helper's precedence and
 * fallback behavior; it does not determine Preview authority or eligibility.
 */
export type FilePreviewKind = "image" | "pdf" | "text" | "audio" | "video" | "archive" | "folder" | "unsupported";

export function filePreviewKind(file: Pick<FileRecord, "file_type" | "extension"> & Partial<Pick<FileRecord, "is_deleted" | "is_stale">>): FilePreviewKind {
  const extension = file.extension.toLowerCase().replace(/^\./, "");
  if (file.file_type.toLocaleLowerCase() === "folder") return "folder";
  if (file.file_type === "Image" || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (file.file_type === "Code" || ["txt", "md", "json", "ts", "tsx", "js", "jsx", "rs", "py", "css", "html"].includes(extension)) return "text";
  if (file.file_type === "Audio") return "audio";
  if (file.file_type === "Video") return "video";
  if (file.file_type === "ArchivePackage" || ["zip", "7z", "rar", "tar", "gz"].includes(extension)) return "archive";
  if (file.is_deleted || file.is_stale) return "unsupported";
  return "unsupported";
}

export function libraryRevealLabel(t: Translator) {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? t("libraryRevealInFinder")
    : t("libraryRevealFile");
}

/** Shared localized labels for File Library presentation consumers. */
export function typeLabel(file: FileRecord, t: Translator) {
  const key = `libraryType${file.file_type === "ArchivePackage" ? "Archive" : file.file_type}` as Parameters<Translator>[0];
  return t(key);
}

export function purposeLabel(file: FileRecord, t: Translator) {
  return t(`libraryPurpose${file.purpose}` as Parameters<Translator>[0]);
}

export function lifecycleLabel(file: FileRecord, t: Translator) {
  return t(`libraryLifecycle${file.lifecycle}` as Parameters<Translator>[0]);
}

export function riskLabel(risk: FileRecord["risk_level"], t: Translator) {
  return t(`libraryRisk${risk}` as Parameters<Translator>[0]);
}
