/**
 * Strict decoder for the W3-07 FolderSummaryPayloadV1 wire.
 *
 * The renderer receives a bounded backend summary, never directory paths or
 * filesystem references. Unknown fields and inconsistent counts fail closed
 * so a mismatched provider cannot silently widen the rendered contract.
 */

export const FOLDER_SUMMARY_VERSION = 1 as const;
export const MAX_FOLDER_CHILDREN_INSPECTED = 100_000;
export const MAX_FOLDER_SAMPLE_ITEMS = 32;
export const MAX_FOLDER_EXTENSION_BUCKETS = 16;
export const MAX_FOLDER_LARGEST_ITEMS = 10;
export const MAX_FOLDER_PROJECT_HINTS = 8;
export const MAX_FOLDER_NAME_CHARS = 512;
export const MAX_FOLDER_EXTENSION_CHARS = 64;
export const MAX_FOLDER_ENCODED_SUMMARY_BYTES = 256 * 1024;

const MAX_FOLDER_HINT_CHARS = 128;
const MAX_SAFE_WIRE_NUMBER = Number.MAX_SAFE_INTEGER;

export type FolderSummaryStateV1 = "partial" | "complete";
export type FolderLimitReasonV1 = "entry_limit" | "deadline";
export type FolderSampleKindV1 = "file" | "directory" | "other";

export interface FolderProgressV1 {
  inspectedEntries: number;
  acceptedChildren: number;
  state: FolderSummaryStateV1;
  limitReason: FolderLimitReasonV1 | null;
}

export interface FolderSampleItemV1 {
  name: string;
  kind: FolderSampleKindV1;
  extension: string | null;
  sizeBytes: number | null;
}

export interface FolderKindCountsV1 {
  files: number;
  directories: number;
  other: number;
}

export interface FolderExtensionCountV1 {
  extension: string;
  count: number;
}

export interface FolderSizeProgressV1 {
  observedBytes: number;
  knownSizeEntries: number;
}

export interface FolderLargestObservedV1 {
  name: string;
  sizeBytes: number;
}

export interface FolderSummaryPayloadV1 {
  version: typeof FOLDER_SUMMARY_VERSION;
  folderName: string;
  progress: FolderProgressV1;
  sample: FolderSampleItemV1[];
  kindCounts: FolderKindCountsV1;
  extensionCounts: FolderExtensionCountV1[];
  sizeProgress: FolderSizeProgressV1;
  largestObserved: FolderLargestObservedV1[];
  projectHints: string[];
}

export function parseFolderSummaryPayload(encodedSummary: string): FolderSummaryPayloadV1 {
  if (typeof encodedSummary !== "string" || byteLength(encodedSummary) > MAX_FOLDER_ENCODED_SUMMARY_BYTES) {
    throw new Error("preview_folder_summary_bound_exceeded");
  }
  let value: unknown;
  try {
    value = JSON.parse(encodedSummary) as unknown;
  } catch {
    throw new Error("preview_folder_summary_invalid");
  }

  const record = asRecord(value, "preview_folder_summary_invalid");
  exactKeys(record, [
    "version",
    "folderName",
    "progress",
    "sample",
    "kindCounts",
    "extensionCounts",
    "sizeProgress",
    "largestObserved",
    "projectHints"
  ]);
  if (record.version !== FOLDER_SUMMARY_VERSION) throw new Error("preview_folder_summary_version_invalid");

  const progress = parseProgress(record.progress);
  const sample = parseSample(record.sample);
  const kindCounts = parseKindCounts(record.kindCounts);
  const extensionCounts = parseExtensionCounts(record.extensionCounts);
  const sizeProgress = parseSizeProgress(record.sizeProgress);
  const largestObserved = parseLargestObserved(record.largestObserved);
  const projectHints = parseProjectHints(record.projectHints);
  const acceptedFromKinds = kindCounts.files + kindCounts.directories + kindCounts.other;
  if (acceptedFromKinds !== progress.acceptedChildren) throw new Error("preview_folder_summary_counts_invalid");
  if (sizeProgress.knownSizeEntries > kindCounts.files || sizeProgress.knownSizeEntries > progress.acceptedChildren) {
    throw new Error("preview_folder_summary_size_progress_invalid");
  }
  const extensionTotal = extensionCounts.reduce((total, bucket) => total + bucket.count, 0);
  if (extensionTotal !== kindCounts.files) throw new Error("preview_folder_summary_extensions_invalid");
  if (progress.state === "complete" && progress.limitReason !== null) {
    throw new Error("preview_folder_summary_completion_invalid");
  }
  if (progress.state === "partial" && progress.limitReason === null) {
    throw new Error("preview_folder_summary_completion_invalid");
  }

  return {
    version: FOLDER_SUMMARY_VERSION,
    folderName: boundedDisplayText(record.folderName, MAX_FOLDER_NAME_CHARS, "preview_folder_name_invalid"),
    progress,
    sample,
    kindCounts,
    extensionCounts,
    sizeProgress,
    largestObserved,
    projectHints
  };
}

function parseProgress(value: unknown): FolderProgressV1 {
  const record = asRecord(value, "preview_folder_progress_invalid");
  exactKeys(record, ["inspectedEntries", "acceptedChildren", "state", "limitReason"]);
  const inspectedEntries = boundedCount(record.inspectedEntries, "preview_folder_progress_invalid", MAX_FOLDER_CHILDREN_INSPECTED);
  const acceptedChildren = boundedCount(record.acceptedChildren, "preview_folder_progress_invalid", MAX_FOLDER_CHILDREN_INSPECTED);
  if (acceptedChildren > inspectedEntries) throw new Error("preview_folder_progress_invalid");
  const state = enumValue(record.state, ["partial", "complete"], "preview_folder_state_invalid") as FolderSummaryStateV1;
  const limitReason = record.limitReason === null
    ? null
    : enumValue(record.limitReason, ["entry_limit", "deadline"], "preview_folder_limit_reason_invalid") as FolderLimitReasonV1;
  return { inspectedEntries, acceptedChildren, state, limitReason };
}

function parseSample(value: unknown): FolderSampleItemV1[] {
  const values = boundedArray(value, MAX_FOLDER_SAMPLE_ITEMS, "preview_folder_sample_bound_exceeded");
  return values.map((item) => {
    const record = asRecord(item, "preview_folder_sample_invalid");
    exactKeys(record, ["name", "kind", "extension", "sizeBytes"]);
    return {
      name: boundedDisplayText(record.name, MAX_FOLDER_NAME_CHARS, "preview_folder_sample_name_invalid"),
      kind: enumValue(record.kind, ["file", "directory", "other"], "preview_folder_sample_kind_invalid") as FolderSampleKindV1,
      extension: nullableExtension(record.extension),
      sizeBytes: nullableCount(record.sizeBytes, "preview_folder_sample_size_invalid")
    };
  });
}

function parseKindCounts(value: unknown): FolderKindCountsV1 {
  const record = asRecord(value, "preview_folder_kind_counts_invalid");
  exactKeys(record, ["files", "directories", "other"]);
  return {
    files: boundedCount(record.files, "preview_folder_kind_counts_invalid", MAX_FOLDER_CHILDREN_INSPECTED),
    directories: boundedCount(record.directories, "preview_folder_kind_counts_invalid", MAX_FOLDER_CHILDREN_INSPECTED),
    other: boundedCount(record.other, "preview_folder_kind_counts_invalid", MAX_FOLDER_CHILDREN_INSPECTED)
  };
}

function parseExtensionCounts(value: unknown): FolderExtensionCountV1[] {
  const values = boundedArray(value, MAX_FOLDER_EXTENSION_BUCKETS, "preview_folder_extensions_bound_exceeded");
  const seen = new Set<string>();
  return values.map((item) => {
    const record = asRecord(item, "preview_folder_extension_invalid");
    exactKeys(record, ["extension", "count"]);
    const extension = boundedExtension(record.extension, "preview_folder_extension_invalid");
    if (seen.has(extension)) throw new Error("preview_folder_extensions_invalid");
    seen.add(extension);
    return {
      extension,
      count: boundedCount(record.count, "preview_folder_extension_invalid", MAX_FOLDER_CHILDREN_INSPECTED)
    };
  });
}

function parseSizeProgress(value: unknown): FolderSizeProgressV1 {
  const record = asRecord(value, "preview_folder_size_progress_invalid");
  exactKeys(record, ["observedBytes", "knownSizeEntries"]);
  return {
    observedBytes: boundedCount(record.observedBytes, "preview_folder_size_progress_invalid"),
    knownSizeEntries: boundedCount(record.knownSizeEntries, "preview_folder_size_progress_invalid", MAX_FOLDER_CHILDREN_INSPECTED)
  };
}

function parseLargestObserved(value: unknown): FolderLargestObservedV1[] {
  const values = boundedArray(value, MAX_FOLDER_LARGEST_ITEMS, "preview_folder_largest_bound_exceeded");
  return values.map((item) => {
    const record = asRecord(item, "preview_folder_largest_invalid");
    exactKeys(record, ["name", "sizeBytes"]);
    return {
      name: boundedDisplayText(record.name, MAX_FOLDER_NAME_CHARS, "preview_folder_largest_name_invalid"),
      sizeBytes: boundedCount(record.sizeBytes, "preview_folder_largest_size_invalid")
    };
  });
}

function parseProjectHints(value: unknown): string[] {
  const values = boundedArray(value, MAX_FOLDER_PROJECT_HINTS, "preview_folder_hints_bound_exceeded");
  return values.map((item) => boundedDisplayText(item, MAX_FOLDER_HINT_CHARS, "preview_folder_hint_invalid"));
}

function nullableExtension(value: unknown): string | null {
  return value === null ? null : boundedExtension(value, "preview_folder_extension_invalid");
}

function boundedExtension(value: unknown, error: string): string {
  const extension = boundedText(value, MAX_FOLDER_EXTENSION_CHARS, error);
  if (extension.includes("/") || extension.includes("\\") || hasControlCharacter(extension)) throw new Error(error);
  return extension;
}

function boundedDisplayText(value: unknown, maxChars: number, error: string): string {
  const text = boundedText(value, maxChars, error);
  if (text.includes("/") || text.includes("\\") || hasControlCharacter(text)) throw new Error(error);
  return text;
}

function boundedText(value: unknown, maxChars: number, error: string): string {
  if (typeof value !== "string" || Array.from(value).length > maxChars) throw new Error(error);
  return value;
}

function boundedCount(value: unknown, error: string, max = MAX_SAFE_WIRE_NUMBER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) throw new Error(error);
  return value as number;
}

function nullableCount(value: unknown, error: string): number | null {
  return value === null ? null : boundedCount(value, error);
}

function boundedArray(value: unknown, maxItems: number, error: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(error.replace("bound_exceeded", "invalid"));
  if (value.length > maxItems) throw new Error(error);
  return value;
}

function enumValue(value: unknown, allowed: readonly string[], error: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(error);
  return value;
}

function asRecord(value: unknown, error: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, required: string[]): void {
  const actual = Object.keys(record).sort();
  const expected = [...required].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error("preview_folder_payload_unknown_field");
  }
}

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
