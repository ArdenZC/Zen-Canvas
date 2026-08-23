/**
 * Strict decoders for the W3-05 provider payloads.
 *
 * The renderer receives only the backend-produced encoded payload. It never
 * parses original file bytes and it never treats a decoded node as authority.
 */

export const STRUCTURED_TREE_SCHEMA_VERSION = 1 as const;
export const TABLE_SCHEMA_VERSION = 1 as const;
export const MAX_STRUCTURED_DEPTH = 64;
export const MAX_STRUCTURED_NODES = 10_000;
export const MAX_STRUCTURED_KEY_BYTES = 1024;
export const MAX_STRUCTURED_SCALAR_BYTES = 16 * 1024;
export const MAX_XML_ATTRIBUTES = 128;
export const MAX_ENCODED_STRUCTURED_BYTES = 1024 * 1024;
export const MAX_TABLE_ROWS = 500;
export const MAX_TABLE_COLUMNS = 64;
export const MAX_TABLE_CELL_BYTES = 16 * 1024;
export const MAX_ENCODED_TABLE_BYTES = 1024 * 1024;

export const ARCHIVE_TREE_SCHEMA_VERSION = 1 as const;
export const MAX_ARCHIVE_ENTRIES_INSPECTED = 20_000;
export const MAX_ARCHIVE_TREE_NODES = 2_000;
export const MAX_ARCHIVE_TREE_DEPTH = 64;
export const MAX_ARCHIVE_ENTRY_NAME_BYTES = 4 * 1024;
export const MAX_ARCHIVE_ENTRY_NAME_CHARS = 2_048;
export const MAX_ARCHIVE_WARNINGS = 32;
export const MAX_ARCHIVE_TREE_CHILDREN = 512;
export const MAX_ENCODED_ARCHIVE_TREE_BYTES = 1024 * 1024;
export const MAX_ARCHIVE_COMPRESSION_METHOD_BYTES = 128;

export type ArchiveLimitReasonV1 =
  | "entry_limit"
  | "tree_limit"
  | "metadata_limit"
  | "source_read_limit"
  | "deadline";
export type ArchiveProgressStateV1 = "complete" | "partial";
export type ArchiveNodeKindV1 = "directory" | "file";
export type ArchiveWarningV1 =
  | "unsafe_name"
  | "entry_limit"
  | "tree_limit"
  | "metadata_limit"
  | "source_read_limit"
  | "deadline";

export interface ArchiveNodeV1 {
  kind: ArchiveNodeKindV1;
  name: string;
  children?: ArchiveNodeV1[];
  compressedSize?: number;
  uncompressedSizeDeclared?: number;
  compressionMethod?: string;
  encrypted?: boolean;
  unsafeName?: boolean;
}

export interface ArchiveTreePayloadV1 {
  version: typeof ARCHIVE_TREE_SCHEMA_VERSION;
  format: "zip";
  progress: {
    inspectedEntries: number;
    state: ArchiveProgressStateV1;
    limitReason: ArchiveLimitReasonV1 | null;
  };
  totals: {
    entriesObserved: number;
    filesObserved: number;
    directoriesObserved: number;
    compressedBytesObserved: number;
    uncompressedBytesDeclaredObserved: number;
  };
  root: ArchiveNodeV1;
  warnings: ArchiveWarningV1[];
}

export type StructuredFormatV1 = "json" | "yaml" | "xml";
export type StructuredScalarTypeV1 = "string" | "number" | "boolean" | "null";

export type StructuredNodeV1 =
  | { kind: "object"; entries: Array<{ key: string; value: StructuredNodeV1 }> }
  | { kind: "array"; items: StructuredNodeV1[] }
  | { kind: "scalar"; scalarType: StructuredScalarTypeV1; value: string }
  | { kind: "element"; name: string; attributes: Array<{ name: string; value: string }>; children: StructuredNodeV1[] }
  | { kind: "text"; value: string };

export interface StructuredTreePayloadV1 {
  schemaVersion: typeof STRUCTURED_TREE_SCHEMA_VERSION;
  format: StructuredFormatV1;
  root: StructuredNodeV1;
  truncation: { depth: boolean; nodes: boolean; strings: boolean };
}

export type TableFormatV1 = "csv" | "tsv";

export interface TablePayloadV1 {
  schemaVersion: typeof TABLE_SCHEMA_VERSION;
  format: TableFormatV1;
  columns: string[];
  rows: string[][];
  truncation: { rows: boolean; columns: boolean; cells: boolean };
}

export function parseStructuredTreePayload(encodedTree: string): StructuredTreePayloadV1 {
  const value = parseEncodedJson(encodedTree, MAX_ENCODED_STRUCTURED_BYTES, "preview_tree_invalid");
  const record = asRecord(value, "preview_tree_invalid");
  exactKeys(record, ["schemaVersion", "format", "root", "truncation"]);
  if (record.schemaVersion !== STRUCTURED_TREE_SCHEMA_VERSION) throw new Error("preview_tree_schema_invalid");
  const format = enumValue(record.format, ["json", "yaml", "xml"], "preview_tree_format_invalid") as StructuredFormatV1;
  const truncation = parseStructuredTruncation(record.truncation);
  const budget = { nodes: 0 };
  return {
    schemaVersion: STRUCTURED_TREE_SCHEMA_VERSION,
    format,
    root: parseStructuredNode(record.root, 0, budget),
    truncation
  };
}

export function parseTablePayload(encodedTable: string): TablePayloadV1 {
  const value = parseEncodedJson(encodedTable, MAX_ENCODED_TABLE_BYTES, "preview_table_invalid");
  const record = asRecord(value, "preview_table_invalid");
  exactKeys(record, ["schemaVersion", "format", "columns", "rows", "truncation"]);
  if (record.schemaVersion !== TABLE_SCHEMA_VERSION) throw new Error("preview_table_schema_invalid");
  const format = enumValue(record.format, ["csv", "tsv"], "preview_table_format_invalid") as TableFormatV1;
  const columns = parseStringArray(record.columns, MAX_TABLE_COLUMNS, MAX_TABLE_CELL_BYTES, "preview_table_columns_invalid");
  const rawRows = asArray(record.rows, "preview_table_rows_invalid");
  if (rawRows.length > MAX_TABLE_ROWS) throw new Error("preview_table_rows_bound_exceeded");
  const rows = rawRows.map((row) => parseStringArray(row, MAX_TABLE_COLUMNS, MAX_TABLE_CELL_BYTES, "preview_table_row_invalid"));
  return {
    schemaVersion: TABLE_SCHEMA_VERSION,
    format,
    columns,
    rows,
    truncation: parseTableTruncation(record.truncation)
  };
}

export function parseArchiveTreePayload(encodedTree: string): ArchiveTreePayloadV1 {
  const value = parseEncodedJson(encodedTree, MAX_ENCODED_ARCHIVE_TREE_BYTES, "preview_archive_invalid");
  const record = asRecord(value, "preview_archive_invalid");
  exactKeys(record, ["version", "format", "progress", "totals", "root", "warnings"]);
  if (record.version !== ARCHIVE_TREE_SCHEMA_VERSION) throw new Error("preview_archive_schema_invalid");
  if (record.format !== "zip") throw new Error("preview_archive_format_invalid");

  const progressRecord = asRecord(record.progress, "preview_archive_progress_invalid");
  exactKeys(progressRecord, ["inspectedEntries", "state", "limitReason"]);
  const inspectedEntries = boundedInteger(
    progressRecord.inspectedEntries,
    MAX_ARCHIVE_ENTRIES_INSPECTED,
    "preview_archive_progress_invalid"
  );
  const state = enumValue(progressRecord.state, ["complete", "partial"], "preview_archive_state_invalid") as ArchiveProgressStateV1;
  const limitReason = nullableEnumValue(
    progressRecord.limitReason,
    ["entry_limit", "tree_limit", "metadata_limit", "source_read_limit", "deadline"],
    "preview_archive_limit_reason_invalid"
  ) as ArchiveLimitReasonV1 | null;
  if ((state === "complete" && limitReason !== null) || (state === "partial" && limitReason === null)) {
    throw new Error("preview_archive_progress_truth_invalid");
  }

  const totalsRecord = asRecord(record.totals, "preview_archive_totals_invalid");
  exactKeys(totalsRecord, [
    "entriesObserved",
    "filesObserved",
    "directoriesObserved",
    "compressedBytesObserved",
    "uncompressedBytesDeclaredObserved"
  ]);
  const totals = {
    entriesObserved: boundedInteger(totalsRecord.entriesObserved, MAX_ARCHIVE_ENTRIES_INSPECTED, "preview_archive_totals_invalid"),
    filesObserved: boundedInteger(totalsRecord.filesObserved, MAX_ARCHIVE_ENTRIES_INSPECTED, "preview_archive_totals_invalid"),
    directoriesObserved: boundedInteger(totalsRecord.directoriesObserved, MAX_ARCHIVE_ENTRIES_INSPECTED, "preview_archive_totals_invalid"),
    compressedBytesObserved: safeInteger(totalsRecord.compressedBytesObserved, "preview_archive_totals_invalid"),
    uncompressedBytesDeclaredObserved: safeInteger(
      totalsRecord.uncompressedBytesDeclaredObserved,
      "preview_archive_totals_invalid"
    )
  };
  if (
    totals.filesObserved + totals.directoriesObserved > totals.entriesObserved ||
    inspectedEntries !== totals.entriesObserved
  ) {
    throw new Error("preview_archive_totals_truth_invalid");
  }

  const budget = { nodes: 0 };
  const root = parseArchiveNode(record.root, 0, budget);
  if (root.kind !== "directory") throw new Error("preview_archive_root_invalid");
  const warnings = asArray(record.warnings, "preview_archive_warnings_invalid");
  if (warnings.length > MAX_ARCHIVE_WARNINGS) throw new Error("preview_archive_warnings_bound_exceeded");
  const parsedWarnings = warnings.map((warning) =>
    enumValue(
      warning,
      ["unsafe_name", "entry_limit", "tree_limit", "metadata_limit", "source_read_limit", "deadline"],
      "preview_archive_warning_invalid"
    ) as ArchiveWarningV1
  );
  return {
    version: ARCHIVE_TREE_SCHEMA_VERSION,
    format: "zip",
    progress: { inspectedEntries, state, limitReason },
    totals,
    root,
    warnings: parsedWarnings
  };
}

function parseArchiveNode(value: unknown, depth: number, budget: { nodes: number }): ArchiveNodeV1 {
  if (depth > MAX_ARCHIVE_TREE_DEPTH) throw new Error("preview_archive_depth_exceeded");
  budget.nodes += 1;
  if (budget.nodes > MAX_ARCHIVE_TREE_NODES) throw new Error("preview_archive_nodes_exceeded");
  const record = asRecord(value, "preview_archive_node_invalid");
  const allowedKeys = [
    "kind",
    "name",
    "children",
    "compressedSize",
    "uncompressedSizeDeclared",
    "compressionMethod",
    "encrypted",
    "unsafeName"
  ];
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) throw new Error("preview_payload_unknown_field");
  if (!("kind" in record) || !("name" in record)) throw new Error("preview_archive_node_invalid");
  const kind = enumValue(record.kind, ["directory", "file"], "preview_archive_kind_invalid") as ArchiveNodeKindV1;
  const name = boundedStringWithChars(
    record.name,
    MAX_ARCHIVE_ENTRY_NAME_BYTES,
    MAX_ARCHIVE_ENTRY_NAME_CHARS,
    "preview_archive_name_invalid"
  );
  if (record.children !== undefined) {
    const children = asArray(record.children, "preview_archive_children_invalid");
    if (children.length > MAX_ARCHIVE_TREE_CHILDREN) throw new Error("preview_archive_children_bound_exceeded");
    if (kind === "file") throw new Error("preview_archive_file_children_invalid");
  }
  const children = record.children === undefined
    ? undefined
    : asArray(record.children, "preview_archive_children_invalid").map((child) => parseArchiveNode(child, depth + 1, budget));
  const compressedSize = optionalSafeInteger(record.compressedSize, "preview_archive_size_invalid");
  const uncompressedSizeDeclared = optionalSafeInteger(record.uncompressedSizeDeclared, "preview_archive_size_invalid");
  const compressionMethod = record.compressionMethod === undefined
    ? undefined
    : boundedString(record.compressionMethod, MAX_ARCHIVE_COMPRESSION_METHOD_BYTES, "preview_archive_compression_invalid");
  const encrypted = record.encrypted === undefined ? undefined : booleanValue(record.encrypted, "preview_archive_flag_invalid");
  const unsafeName = record.unsafeName === undefined ? undefined : booleanValue(record.unsafeName, "preview_archive_flag_invalid");
  if (kind === "directory" && (compressedSize !== undefined || uncompressedSizeDeclared !== undefined || compressionMethod !== undefined || encrypted !== undefined)) {
    throw new Error("preview_archive_directory_metadata_invalid");
  }
  return {
    kind,
    name,
    ...(children === undefined ? {} : { children }),
    ...(compressedSize === undefined ? {} : { compressedSize }),
    ...(uncompressedSizeDeclared === undefined ? {} : { uncompressedSizeDeclared }),
    ...(compressionMethod === undefined ? {} : { compressionMethod }),
    ...(encrypted === undefined ? {} : { encrypted }),
    ...(unsafeName === undefined ? {} : { unsafeName })
  };
}

function parseEncodedJson(encoded: unknown, maxBytes: number, error: string): unknown {
  if (typeof encoded !== "string" || byteLength(encoded) > maxBytes) throw new Error(error);
  try {
    return JSON.parse(encoded) as unknown;
  } catch {
    throw new Error(error);
  }
}

function parseStructuredNode(value: unknown, depth: number, budget: { nodes: number }): StructuredNodeV1 {
  if (depth > MAX_STRUCTURED_DEPTH) throw new Error("preview_tree_depth_exceeded");
  budget.nodes += 1;
  if (budget.nodes > MAX_STRUCTURED_NODES) throw new Error("preview_tree_nodes_exceeded");
  const record = asRecord(value, "preview_tree_node_invalid");
  if (typeof record.kind !== "string") throw new Error("preview_tree_kind_invalid");
  switch (record.kind) {
    case "object": {
      exactKeys(record, ["kind", "entries"]);
      const entries = asArray(record.entries, "preview_tree_entries_invalid").map((entry) => {
        const entryRecord = asRecord(entry, "preview_tree_entry_invalid");
        exactKeys(entryRecord, ["key", "value"]);
        return {
          key: boundedString(entryRecord.key, MAX_STRUCTURED_KEY_BYTES, "preview_tree_key_invalid"),
          value: parseStructuredNode(entryRecord.value, depth + 1, budget)
        };
      });
      return { kind: "object", entries };
    }
    case "array": {
      exactKeys(record, ["kind", "items"]);
      return {
        kind: "array",
        items: asArray(record.items, "preview_tree_items_invalid").map((item) => parseStructuredNode(item, depth + 1, budget))
      };
    }
    case "scalar":
      exactKeys(record, ["kind", "scalarType", "value"]);
      return {
        kind: "scalar",
        scalarType: enumValue(record.scalarType, ["string", "number", "boolean", "null"], "preview_tree_scalar_type_invalid") as StructuredScalarTypeV1,
        value: boundedString(record.value, MAX_STRUCTURED_SCALAR_BYTES, "preview_tree_scalar_value_invalid")
      };
    case "element": {
      exactKeys(record, ["kind", "name", "attributes", "children"]);
      const attributes = asArray(record.attributes, "preview_tree_attributes_invalid");
      if (attributes.length > MAX_XML_ATTRIBUTES) throw new Error("preview_tree_attributes_bound_exceeded");
      return {
        kind: "element",
        name: boundedString(record.name, MAX_STRUCTURED_KEY_BYTES, "preview_tree_name_invalid"),
        attributes: attributes.map((attribute) => {
          const attributeRecord = asRecord(attribute, "preview_tree_attribute_invalid");
          exactKeys(attributeRecord, ["name", "value"]);
          return {
            name: boundedString(attributeRecord.name, MAX_STRUCTURED_KEY_BYTES, "preview_tree_attribute_name_invalid"),
            value: boundedString(attributeRecord.value, MAX_STRUCTURED_SCALAR_BYTES, "preview_tree_attribute_value_invalid")
          };
        }),
        children: asArray(record.children, "preview_tree_children_invalid").map((child) => parseStructuredNode(child, depth + 1, budget))
      };
    }
    case "text":
      exactKeys(record, ["kind", "value"]);
      return { kind: "text", value: boundedString(record.value, MAX_STRUCTURED_SCALAR_BYTES, "preview_tree_text_invalid") };
    default:
      throw new Error("preview_tree_kind_unknown");
  }
}

function parseStructuredTruncation(value: unknown): StructuredTreePayloadV1["truncation"] {
  const record = asRecord(value, "preview_tree_truncation_invalid");
  exactKeys(record, ["depth", "nodes", "strings"]);
  return {
    depth: booleanValue(record.depth, "preview_tree_truncation_invalid"),
    nodes: booleanValue(record.nodes, "preview_tree_truncation_invalid"),
    strings: booleanValue(record.strings, "preview_tree_truncation_invalid")
  };
}

function parseTableTruncation(value: unknown): TablePayloadV1["truncation"] {
  const record = asRecord(value, "preview_table_truncation_invalid");
  exactKeys(record, ["rows", "columns", "cells"]);
  return {
    rows: booleanValue(record.rows, "preview_table_truncation_invalid"),
    columns: booleanValue(record.columns, "preview_table_truncation_invalid"),
    cells: booleanValue(record.cells, "preview_table_truncation_invalid")
  };
}

function parseStringArray(value: unknown, maxItems: number, maxBytes: number, error: string): string[] {
  const values = asArray(value, error);
  if (values.length > maxItems) throw new Error(error.replace("invalid", "bound_exceeded"));
  return values.map((item) => boundedString(item, maxBytes, error));
}

function asRecord(value: unknown, error: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
}

function asArray(value: unknown, error: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(error);
  return value;
}

function exactKeys(record: Record<string, unknown>, required: string[]): void {
  const actual = Object.keys(record).sort();
  const expected = [...required].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error("preview_payload_unknown_field");
  }
}

function boundedString(value: unknown, maxBytes: number, error: string): string {
  if (typeof value !== "string" || byteLength(value) > maxBytes) throw new Error(error);
  return value;
}

function enumValue(value: unknown, allowed: readonly string[], error: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(error);
  return value;
}

function nullableEnumValue(value: unknown, allowed: readonly string[], error: string): string | null {
  if (value === null) return null;
  return enumValue(value, allowed, error);
}

function boundedInteger(value: unknown, maximum: number, error: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) throw new Error(error);
  return value as number;
}

function safeInteger(value: unknown, error: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(error);
  return value as number;
}

function optionalSafeInteger(value: unknown, error: string): number | undefined {
  if (value === undefined) return undefined;
  return safeInteger(value, error);
}

function boundedStringWithChars(value: unknown, maxBytes: number, maxChars: number, error: string): string {
  const result = boundedString(value, maxBytes, error);
  if (Array.from(result).length > maxChars) throw new Error(error);
  return result;
}

function booleanValue(value: unknown, error: string): boolean {
  if (typeof value !== "boolean") throw new Error(error);
  return value;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
