import { Archive, File, FileCode2, FileImage, FileText, Folder, Music2, Package, Video, type LucideIcon } from "lucide-react";
import type { FileRecord } from "../types/domain";
import { filePreviewKind } from "../views/vault/fileLibraryModel";

export function fileIconForRecord(file: Pick<FileRecord, "file_type" | "extension">): LucideIcon {
  const kind = filePreviewKind(file);
  if (kind === "image") return FileImage;
  if (kind === "pdf") return FileText;
  if (kind === "text") return FileCode2;
  if (kind === "audio") return Music2;
  if (kind === "video") return Video;
  if (kind === "archive") return Archive;
  if (kind === "folder") return Folder;
  if (file.file_type === "Installer") return Package;
  if (file.file_type === "Document" || file.file_type === "Spreadsheet" || file.file_type === "Presentation") return FileText;
  return File;
}

export function FileTypeIcon({
  file,
  size = 17,
  className
}: {
  file: Pick<FileRecord, "file_type" | "extension">;
  size?: number;
  className?: string;
}) {
  const Icon = fileIconForRecord(file);
  return <Icon size={size} className={className} aria-hidden="true" />;
}
