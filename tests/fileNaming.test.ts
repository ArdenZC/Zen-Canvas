import { describe, expect, it } from "vitest";
import { normalizeProposedFileNameExtension } from "../src/utils/fileNaming";

describe("file extension protection", () => {
  it("appends missing extensions without duplicating them", () => {
    expect(normalizeProposedFileNameExtension("Install_Package.lnk", "Install_Package")).toEqual({
      name: "Install_Package.lnk",
      error: null
    });
    expect(normalizeProposedFileNameExtension("archive.tar.gz", "archive-2026")).toEqual({
      name: "archive-2026.gz",
      error: null
    });
  });

  it("preserves extension spelling case and supports shortcut extensions", () => {
    expect(normalizeProposedFileNameExtension("My_Shortcut.LNK", "Renamed.lnk")).toEqual({
      name: "Renamed.LNK",
      error: null
    });
    expect(normalizeProposedFileNameExtension("Website.url", "Website_Archive")).toEqual({
      name: "Website_Archive.url",
      error: null
    });
    expect(normalizeProposedFileNameExtension("Product.appref-ms", "Product_Archive.appref-ms")).toEqual({
      name: "Product_Archive.appref-ms",
      error: null
    });
  });

  it("rejects changed or invented extensions and keeps extensionless names extensionless", () => {
    expect(normalizeProposedFileNameExtension("Install_Package.lnk", "Install_Package.exe")).toEqual({
      name: "Install_Package.exe",
      error: "extension"
    });
    expect(normalizeProposedFileNameExtension("README", "README.txt")).toEqual({
      name: "README.txt",
      error: "extension"
    });
    expect(normalizeProposedFileNameExtension(".gitignore", ".gitignore")).toEqual({
      name: ".gitignore",
      error: null
    });
  });
});
