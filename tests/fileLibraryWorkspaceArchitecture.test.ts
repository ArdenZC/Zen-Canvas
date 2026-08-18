import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("W2-01 File Library workspace architecture", () => {
  it("makes FileLibraryWorkspace the AppShell Library route owner", () => {
    const appShell = read("src/components/AppShell.tsx");

    expect(appShell).toContain('import("../views/fileLibrary/FileLibraryWorkspace")');
    expect(appShell).toContain('else if (view === "library") content = <FileLibraryWorkspace />;');
    expect(appShell).not.toContain('import("../views/vault/VaultView")');
    expect(appShell).toContain('view === "library" ? fileLibraryWorkspaceClass : workspaceClass');
    expect(appShell).toContain('view !== "library" ? (');
    expect(appShell).toContain("<ShellViewHeading");
  });

  it("keeps the existing managed Library behind a narrow strangler adapter", () => {
    const workspace = read("src/views/fileLibrary/FileLibraryWorkspace.tsx");
    const adapter = read("src/views/fileLibrary/LibraryModeAdapter.tsx");

    expect(workspace).toContain("<LibraryModeAdapter />");
    expect(workspace).not.toContain("VaultView");
    expect(adapter).toContain('import("../vault/VaultView")');
    expect(adapter).toContain("<VaultView />");
  });

  it("keeps navigation authority in W1 and Query V2 authority out of the shell controller", () => {
    const controller = read("src/views/fileLibrary/fileLibraryExperienceController.ts");

    expect(controller).toContain("FileWorkspaceController");
    expect(controller).toContain("session.lastLibraryTarget");
    expect(controller).toContain("session.lastBrowseTarget");
    expect(controller).toContain("this.workspace.navigate(target");
    expect(controller).toContain("serializeRestoreLocator");
    expect(controller).not.toContain("useFileLibraryQueryStore");
    expect(controller).not.toContain("useFileLibrarySelectionStore");
    expect(controller).not.toContain("zustand");
    expect(controller).not.toContain("browseStartEnumeration");
    expect(controller).not.toContain("locationList");
  });

  it("uses File Library container width rather than viewport width for pane ownership", () => {
    const css = read("src/views/fileLibrary/FileLibraryWorkspace.css");

    expect(css).toContain("container: file-library / inline-size");
    expect(css).toContain("@container file-library (max-width: 1119px)");
    expect(css).toContain("@container file-library (max-width: 819px)");
    expect(css).toContain("grid-template-columns: 192px minmax(0, 1fr)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("does not prematurely implement W2-02+ shared List/Grid/Context authorities", () => {
    const workspace = read("src/views/fileLibrary/FileLibraryWorkspace.tsx");
    const controller = read("src/views/fileLibrary/fileLibraryExperienceController.ts");

    expect(workspace).not.toContain("thumbnailRequest");
    expect(workspace).not.toContain("FileLibraryList");
    expect(workspace).not.toContain("FileLibraryInspector");
    expect(controller).not.toContain("LibrarySelectionV1");
    expect(controller).not.toContain("thumbnailRequest");
  });
});
