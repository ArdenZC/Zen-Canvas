import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adaptBrowseEntry,
  adaptBrowsePageCollection,
  adaptLibraryCollection,
  adaptLibrarySummary,
  adaptPresentationWindow
} from "../src/views/fileLibrary/presentation/adapters";
import type {
  FileLibrarySummary,
  FileQuerySpecV2
} from "../src/types/domain";
import type {
  BrowseEntry,
  BrowseEntryRef,
  BrowsePage,
  BrowsePathRef,
  EntryRef
} from "../src/types/fileWorkspace";
import type {
  BrowsePresentationEntry,
  LibraryPresentationEntry,
  PresentationEntry
} from "../src/views/fileLibrary/presentation/contracts";

const query: FileQuerySpecV2 = {
  scope: { kind: "roots", scanRootIds: ["root-1"] },
  text: "report!",
  filters: {
    fileTypes: [],
    purposes: [],
    lifecycles: [],
    risks: [],
    sizeMin: null,
    sizeMax: null,
    modifiedFrom: null,
    modifiedTo: null,
    createdFrom: null,
    createdTo: null,
    duplicate: "any",
    review: "any",
    tagsAllOf: [],
    tagsAnyOf: [],
    tagsNoneOf: []
  },
  sort: { kind: "name", direction: "asc" }
};

function librarySummary(id = "managed-1"): FileLibrarySummary {
  return {
    id,
    name: "report.pdf",
    extension: "pdf",
    displayDirectory: "Documents",
    size: 1024,
    modifiedAt: 10,
    createdAt: 5,
    isDirectory: false,
    fileType: "Document",
    purpose: "reference",
    lifecycle: "Active",
    risk: "Normal",
    confidence: 1,
    isDuplicate: false,
    requiresReview: false,
    isStale: false,
    tags: [],
    tagCount: 0
  };
}

function browseEntry(
  ref: BrowseEntryRef = { kind: "ephemeral", browseSessionId: "session-1", entryId: "entry-1" },
  overrides: Partial<BrowseEntry> = {}
): BrowseEntry {
  return {
    ref,
    name: "report.pdf",
    displayPath: "Documents/report.pdf",
    kind: "file",
    extension: "pdf",
    size: 1024,
    modifiedAt: 10,
    createdAt: 5,
    materialization: "unknown",
    ...overrides
  };
}

const managedRef: EntryRef = { kind: "managed", fileId: "managed-1" };
const ephemeralRef: BrowseEntryRef = {
  kind: "ephemeral",
  browseSessionId: "session-1",
  entryId: "entry-1"
};

// These assertions are compile-time guards against source identity collapse.
const managedPresentationEntry: LibraryPresentationEntry = adaptLibrarySummary(librarySummary());
const browsePresentationEntry: BrowsePresentationEntry = adaptBrowseEntry(browseEntry(ephemeralRef));
// @ts-expect-error A managed ref cannot masquerade as a Browse ref.
const invalidBrowseRef: BrowseEntryRef = managedRef;
// @ts-expect-error A Library presentation entry cannot masquerade as Browse.
const invalidBrowseEntry: BrowsePresentationEntry = managedPresentationEntry;
void browsePresentationEntry;
void invalidBrowseRef;
void invalidBrowseEntry;

describe("W2-02 shared presentation contracts", () => {
  it("discriminates Library and Browse while retaining source-owned refs", () => {
    const library = adaptLibrarySummary(librarySummary("managed:1"));
    const browseSourceRef: BrowseEntryRef = {
      kind: "ephemeral",
      browseSessionId: "browse:1",
      entryId: "entry|1"
    };
    const browse = adaptBrowseEntry(browseEntry(browseSourceRef));

    expect(library.source).toBe("library");
    expect(library.entryRef).toEqual({ kind: "managed", fileId: "managed:1" });
    expect(library).not.toHaveProperty("id");
    expect(browse.source).toBe("browse");
    expect(browse.entryRef).toBe(browseSourceRef);
    expect(browse.entryRef).toEqual({
      kind: "ephemeral",
      browseSessionId: "browse:1",
      entryId: "entry|1"
    });
    expect(browse).not.toHaveProperty("id");
  });

  it("retains Browse lifetime refs and collection publication identity exactly", () => {
    const pathRef: BrowsePathRef = { id: "nested-path" };
    const ref: BrowseEntryRef = {
      kind: "ephemeral",
      browseSessionId: "session:/|%#🔥",
      entryId: "entry:../🔥"
    };
    const entry = browseEntry(ref, { pathRef, kind: "directory", size: undefined });
    const page: BrowsePage = {
      sessionId: "session:/|%#🔥",
      requestId: "request:1",
      enumerationId: "enumeration|1",
      entries: [entry],
      nextCursor: "cursor",
      completion: "partial"
    };

    const adaptedEntry = adaptBrowseEntry(entry);
    const adaptedCollection = adaptBrowsePageCollection(page);

    expect(adaptedEntry.entryRef).toBe(ref);
    expect(adaptedEntry.pathRef).toBe(pathRef);
    expect(adaptedCollection).toEqual({
      source: "browse",
      provenance: {
        sessionId: page.sessionId,
        requestId: page.requestId,
        enumerationId: page.enumerationId,
        completion: "partial"
      }
    });
    expect(adaptedCollection.provenance.knownCount).toBeUndefined();
    expect(adaptedCollection).not.toHaveProperty("entries");
  });

  it("publishes knownCount only on a source-declared complete collection", () => {
    const complete: BrowsePage = {
      sessionId: "session-complete",
      requestId: "request-complete",
      enumerationId: "enumeration-complete",
      entries: [browseEntry()],
      completion: "complete",
      knownCount: 100_000
    };

    const partialWithUntrustedCount = {
      ...complete,
      completion: "partial" as const,
      knownCount: 1
    } satisfies BrowsePage;

    expect(adaptBrowsePageCollection(complete).provenance).toMatchObject({
      completion: "complete",
      knownCount: 100_000
    });
    expect(adaptBrowsePageCollection(partialWithUntrustedCount).provenance).toEqual({
      sessionId: "session-complete",
      requestId: "request-complete",
      enumerationId: "enumeration-complete",
      completion: "partial"
    });
  });

  it("keeps absent metadata unknown and does not invent capability authority", () => {
    const browse = adaptBrowseEntry(browseEntry(undefined, {
      size: undefined,
      modifiedAt: undefined,
      createdAt: undefined,
      extension: undefined,
      materialization: "unknown"
    }));
    const libraryWithoutSemantics = adaptLibrarySummary(librarySummary("library-unknown"));
    const libraryWithUnknownSemantics = adaptLibrarySummary({
      ...librarySummary("library-unknown-state"),
      size: 0,
      modifiedAt: 0,
      createdAt: 0,
      nativeSemantics: {
        isPackage: false,
        cloudBacking: "unknown",
        contentAvailability: "unknown"
      }
    });

    expect(browse).not.toHaveProperty("size");
    expect(browse).not.toHaveProperty("modifiedAt");
    expect(browse).not.toHaveProperty("createdAt");
    expect(browse).not.toHaveProperty("extension");
    expect(browse.materialization).toBe("unknown");
    expect(browse).not.toHaveProperty("capabilities");
    expect(libraryWithoutSemantics).not.toHaveProperty("materialization");
    expect(libraryWithUnknownSemantics.size).toBe(0);
    expect(libraryWithUnknownSemantics.modifiedAt).toBe(0);
    expect(libraryWithUnknownSemantics.createdAt).toBe(0);
    expect(libraryWithUnknownSemantics.materialization).toBe("unknown");
  });

  it("keeps Query V2 provenance once at collection scope", () => {
    const context = adaptLibraryCollection({
      queryFingerprint: "fingerprint-1",
      snapshotRevision: 7
    }, query);
    const entry = adaptLibrarySummary(librarySummary());

    expect(context).toEqual({
      source: "library",
      provenance: {
        queryFingerprint: "fingerprint-1",
        snapshotRevision: 7,
        query
      }
    });
    expect(context.provenance.query).not.toBe(query);
    expect(entry).not.toHaveProperty("query");
    expect(entry).not.toHaveProperty("queryFingerprint");
    expect(entry).not.toHaveProperty("snapshotRevision");
    expect(entry).not.toHaveProperty("provenance");

    query.filters.tagsAllOf.push("mutated-after-adaptation");
    expect(context.provenance.query?.filters.tagsAllOf).toEqual([]);
    query.filters.tagsAllOf.pop();
  });

  it("uses structural render keys for adversarial opaque identities", () => {
    const ids = [
      "a:b",
      "a|b",
      "library:foo",
      "browse:foo",
      "../foo",
      "%3A",
      "🔥",
      "",
      ":|%#/🔥",
      "[\"library\",\"foo\"]"
    ];
    const keys = [
      ...ids.map((id) => adaptLibrarySummary(librarySummary(id)).renderKey),
      ...ids.map((id, index) => adaptBrowseEntry(browseEntry({
        kind: "ephemeral",
        browseSessionId: id,
        entryId: `entry-${index}`
      })).renderKey),
      adaptBrowseEntry(browseEntry({
        kind: "ephemeral",
        browseSessionId: "library",
        entryId: "foo"
      })).renderKey,
      adaptLibrarySummary(librarySummary("library")).renderKey
    ];

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith("[\"presentation-entry-v1\""))).toBe(true);
    expect(readFileSync(resolve("src/views/fileLibrary/presentation/adapters.ts"), "utf8"))
      .not.toContain("parseRenderKey");
  });

  it("keeps 100k structural evidence compact and adapts only a rendering window", () => {
    const context = adaptLibraryCollection({
      queryFingerprint: "100k-fingerprint",
      snapshotRevision: 100
    }, query);
    const logicalSourceCount = 100_000;
    const visibleWindow: FileLibrarySummary[] = [];
    let observedLogicalEntries = 0;

    for (let index = 0; index < logicalSourceCount; index += 1) {
      observedLogicalEntries += 1;
      if (index < 64) visibleWindow.push(librarySummary(`file-${index}`));
    }

    const rendered = adaptPresentationWindow(visibleWindow);
    expect(observedLogicalEntries).toBe(100_000);
    expect(rendered).toHaveLength(64);
    expect(rendered.every((entry) => entry.source === "library")).toBe(true);
    expect(Object.keys(context)).toEqual(["source", "provenance"]);
    expect(Object.keys(context.provenance)).toEqual([
      "queryFingerprint",
      "snapshotRevision",
      "query"
    ]);
    expect(context).not.toHaveProperty("entries");
    expect(context.provenance).not.toHaveProperty("all_matching");
    expect(context.provenance).not.toHaveProperty("allMatching");
    expect(rendered.every((entry) => !("query" in entry))).toBe(true);
  });

  it("exposes only pure adapters and no cross-source runtime authority", () => {
    const adapterSource = readFileSync(
      resolve("src/views/fileLibrary/presentation/adapters.ts"),
      "utf8"
    );
    const contractSource = readFileSync(
      resolve("src/views/fileLibrary/presentation/contracts.ts"),
      "utf8"
    );
    const source = `${adapterSource}\n${contractSource}`;

    expect(source).not.toMatch(/zustand|invokeCommand|tauriApi|usePresentationSelectionStore|SharedFocusManager/i);
    expect(source).not.toMatch(/ThumbnailRequest|resolveLocation|locationToPath|parseRenderKey/);
    expect(source).not.toMatch(/toggleSelection|selectAll|rangeAnchor|focusedEntryId/);
    expect(source).not.toMatch(/navigate\(|open\(|delete\(|rename\(/);
    expect(adapterSource).toContain("export function adaptLibrarySummary");
    expect(adapterSource).toContain("export function adaptBrowseEntry");
    expect(adapterSource).toContain("export function adaptLibraryCollection");
    expect(adapterSource).toContain("export function adaptBrowsePageCollection");
  });

  it("retains the shared entry union as source-discriminated at compile time", () => {
    const entries: PresentationEntry[] = [managedPresentationEntry, browsePresentationEntry];
    expect(entries.map((entry) => entry.source)).toEqual(["library", "browse"]);
  });
});
