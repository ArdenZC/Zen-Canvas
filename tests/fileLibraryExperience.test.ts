// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  FileWorkspaceController,
  WorkspaceSession,
  type FileWorkspaceApi
} from "../src/fileWorkspace";
import { makeTranslator } from "../src/i18n";
import { WorkspaceCommandBar } from "../src/views/fileLibrary/FileLibraryWorkspace";
import { FileLibraryExperienceProvider, useFileLibraryExperience } from "../src/views/fileLibrary/FileLibraryExperienceProvider";
import {
  FileLibraryExperienceController,
  LEGACY_LIBRARY_MIGRATION_TARGET
} from "../src/views/fileLibrary/fileLibraryExperience";
import type { FileLibraryExperienceState } from "../src/views/fileLibrary/fileLibraryExperience";
import type { BrowseOpenResponse, BrowsePage } from "../src/types/fileWorkspace";

const t = makeTranslator("zh");

function fakeResponse(sessionId = "browse-session"): BrowseOpenResponse {
  return {
    sessionId,
    location: {
      ref: { kind: "ephemeral", browseSessionId: sessionId, locationId: "location" },
      displayName: "Documents",
      kind: "local",
      availability: "available",
      freshness: "current",
      capabilities: {
        canBrowse: true,
        canReadMetadata: true,
        canPreview: true,
        canWatch: true,
        canRequestMaterialization: false,
        canAddToLibrary: true
      }
    },
    rootPathRef: { id: "root" }
  };
}

function fakeApi(overrides: Partial<FileWorkspaceApi> = {}): FileWorkspaceApi {
  const page: BrowsePage = {
    sessionId: "browse-session",
    requestId: "enumeration-request",
    enumerationId: "enumeration",
    entries: [],
    completion: "complete"
  };
  return {
    browseOpen: async () => fakeResponse(),
    browseRestore: async () => { throw new Error("restore should not be used"); },
    browseStartEnumeration: async () => page,
    browseNextPage: async () => page,
    browseCancel: async () => undefined,
    browseReleasePage: async () => undefined,
    browseReleasePath: async () => undefined,
    browseRetainPath: async () => undefined,
    browseDispose: async () => undefined,
    locationList: async () => [],
    changeStart: async ({ sessionId, pathRef }) => ({ monitorId: "monitor", sessionId, pathRef }),
    changePending: async () => ({ monitorId: "monitor", sequence: 1, hint: { kind: "content_changed" } }),
    changeRefresh: async () => page,
    changeDispose: async () => undefined,
    readEligibility: async ({ source }) => ({ source, eligibility: "eligible" }),
    thumbnailRequest: async () => ({ cacheKey: "thumbnail", bytes: new Uint8Array() }),
    thumbnailCancel: async () => true,
    previewCreate: async () => { throw new Error("preview should not be used"); },
    previewSnapshot: async () => { throw new Error("preview should not be used"); },
    previewStart: async () => { throw new Error("preview should not be used"); },
    previewCancel: async () => true,
    previewDispose: async () => true,
    previewSwitchSource: async () => { throw new Error("preview should not be used"); },
    ...overrides
  };
}

function experienceWithApi(overrides: Partial<FileWorkspaceApi> = {}) {
  const session = new WorkspaceSession({ initialTarget: LEGACY_LIBRARY_MIGRATION_TARGET });
  const workspace = new FileWorkspaceController(fakeApi(overrides), session);
  return { experience: new FileLibraryExperienceController(workspace), workspace, session };
}

describe("W2-01 File Library Experience Controller", () => {
  it("keeps first-entry Browse detached and non-authoritative", async () => {
    const browseOpen = vi.fn(async () => fakeResponse());
    const { experience, session } = experienceWithApi({ browseOpen });

    await expect(experience.switchMode("browse")).resolves.toBe(true);
    expect(experience.getState().mode).toBe("browse");
    expect(experience.getState().detachedBrowse).toBe(true);
    expect(session.getState().currentTarget).toEqual(LEGACY_LIBRARY_MIGRATION_TARGET);
    expect(session.getState().history).toHaveLength(1);
    expect(session.getState().lastBrowseTarget).toBeNull();
    expect(browseOpen).not.toHaveBeenCalled();

    await expect(experience.switchMode("library")).resolves.toBe(true);
    expect(experience.getState().mode).toBe("library");
    expect(experience.getState().detachedBrowse).toBe(false);
    await experience.dispose();
  });

  it("routes remembered mode switching through controller cleanup", async () => {
    const browseDispose = vi.fn(async () => undefined);
    const browseReleasePage = vi.fn(async () => undefined);
    const changeDispose = vi.fn(async () => undefined);
    const { experience, workspace } = experienceWithApi({ browseDispose, browseReleasePage, changeDispose });

    const opened = await experience.openBrowse({ platform: "windows", routingHint: "Documents" });
    expect(opened).not.toBeNull();
    await workspace.startEnumeration(undefined, "enumeration-request", 10);
    await workspace.startChange({ id: "root" });

    await expect(experience.switchMode("library")).resolves.toBe(true);
    expect(experience.getState().mode).toBe("library");
    expect(experience.getState().workspace.browse).toBeNull();
    expect(changeDispose).toHaveBeenCalledWith({ monitorId: "monitor" });
    expect(browseReleasePage).toHaveBeenCalledWith({ page: expect.anything() });
    expect(browseDispose).not.toHaveBeenCalled();

    await expect(experience.switchMode("browse")).resolves.toBe(true);
    expect(experience.getState().mode).toBe("browse");
    expect(experience.getState().detachedBrowse).toBe(false);
    expect(experience.getState().workspace.browse?.sessionId).toBe(opened?.sessionId);
    await experience.dispose();
    expect(browseDispose).toHaveBeenCalledWith({ sessionId: opened?.sessionId });
  });

  it("suspends disposable work while retaining W1 history/session references", async () => {
    const browseReleasePage = vi.fn(async () => undefined);
    const browseDispose = vi.fn(async () => undefined);
    const { experience, workspace, session } = experienceWithApi({ browseReleasePage, browseDispose });

    const opened = await experience.openBrowse({ platform: "windows", routingHint: "Documents" });
    await workspace.startEnumeration(undefined, "suspend-enumeration", 10);
    const before = session.getState();

    await expect(experience.suspend()).resolves.toBe(true);
    const suspended = experience.getState();
    expect(suspended.workspace.suspended).toBe(true);
    expect(suspended.workspace.browse).toBeNull();
    expect(suspended.workspace.page).toBeNull();
    expect(suspended.mode).toBe("browse");
    expect(suspended.detachedBrowse).toBe(false);
    expect(suspended.workspace.session.currentTarget).toEqual(before.currentTarget);
    expect(suspended.workspace.session.history).toEqual(before.history);
    expect(suspended.workspace.session.lastBrowseTarget).toEqual(before.lastBrowseTarget);
    expect(browseReleasePage).toHaveBeenCalledWith({ page: expect.anything() });
    expect(browseDispose).not.toHaveBeenCalled();

    await expect(experience.resume()).resolves.toBe(true);
    expect(experience.getState().workspace.suspended).toBe(false);
    expect(experience.getState().workspace.browse?.sessionId).toBe(opened?.sessionId);

    await experience.dispose();
    expect(browseDispose).toHaveBeenCalledWith({ sessionId: opened?.sessionId });
  });
});

describe("W2-01 File Library Workspace shell contract", () => {
  it("keeps the command bar localized and hides the migration key", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceCommandBar, {
      layout: "large",
      mode: "library",
      targetLabel: t("fileLibrary"),
      canGoBack: false,
      canGoForward: false,
      onBack: vi.fn(),
      onForward: vi.fn(),
      onModeChange: vi.fn(),
      onOpenNavigation: vi.fn(),
      navigationOpen: false,
      navigationTriggerRef: { current: null },
      t
    }));

    expect(html).toContain("文件库");
    expect(html).toContain("浏览");
    expect(html).not.toContain("legacy_library");
    expect(html).toContain('data-file-library-mode="library"');
    expect(html).toContain('data-file-library-mode="browse"');
  });

  it("keeps Vault as the one W2-01 Library content adapter", () => {
    const shell = readFileSync(resolve("src/components/AppShell.tsx"), "utf8");
    const workspace = readFileSync(resolve("src/views/fileLibrary/FileLibraryWorkspace.tsx"), "utf8");

    expect(shell).toContain("FileLibraryExperienceProvider");
    expect(shell).toContain("FileLibraryWorkspace");
    expect(shell).not.toContain("const VaultView = lazy");
    expect(workspace).toContain('data-library-migration-adapter="legacy-vault"');
    expect(workspace).toContain('import("../vault/VaultView")');
    expect(workspace).not.toContain("useFileLibraryStore");
    expect(workspace).not.toContain("Query V2");
    expect(workspace).not.toContain("legacy_library");
  });
});

function ExperienceProbe({ onCapture }: { onCapture: (value: { controller: FileLibraryExperienceController; state: FileLibraryExperienceState }) => void }) {
  onCapture(useFileLibraryExperience());
  return null;
}

function experienceProviderChild(onCapture: (value: { controller: FileLibraryExperienceController; state: FileLibraryExperienceState }) => void): ReactNode {
  return createElement(ExperienceProbe, { onCapture });
}

describe("W2-01 AppShell-lifetime provider", () => {
  it("keeps one controller owner across inactive and active route projections", async () => {
    const controller = new FileLibraryExperienceController(
      new FileWorkspaceController(
        fakeApi(),
        new WorkspaceSession({ initialTarget: LEGACY_LIBRARY_MIGRATION_TARGET })
      )
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let captured: { controller: FileLibraryExperienceController; state: FileLibraryExperienceState } | undefined;
    const onCapture = (value: { controller: FileLibraryExperienceController; state: FileLibraryExperienceState }) => {
      captured = value;
    };

    await act(async () => {
      root.render(createElement(FileLibraryExperienceProvider, {
        active: true,
        controller,
        children: experienceProviderChild(onCapture)
      }));
    });
    expect(captured?.controller).toBe(controller);

    await act(async () => {
      root.render(createElement(FileLibraryExperienceProvider, {
        active: false,
        controller,
        children: experienceProviderChild(onCapture)
      }));
    });
    expect(controller.workspace.getState().suspended).toBe(true);

    await act(async () => {
      root.render(createElement(FileLibraryExperienceProvider, {
        active: true,
        controller,
        children: experienceProviderChild(onCapture)
      }));
    });
    expect(captured?.controller).toBe(controller);
    expect(controller.workspace.getState().suspended).toBe(false);

    await act(async () => root.unmount());
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    expect(controller.workspace.session.disposed).toBe(true);
    container.remove();
  });
});
