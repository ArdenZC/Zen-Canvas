import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { assertCheckoutEvidence } from "./ciEvidence.mjs";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W211_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const EXPECTED_CHECKOUT_SHA = process.env.W211_EXPECTED_CHECKOUT_SHA ?? null;
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
if (EXPECTED_CHECKOUT_SHA) assertCheckoutEvidence(EXPECTED_CHECKOUT_SHA, ACTUAL_CHECKOUT_SHA);

const FIXTURE_QUERY = "w2-11-browser-fixture=integrated";
const LIBRARY_TOTAL = 100_000;
const BROWSE_TOTAL = 100_000;
const BROWSE_SCAN_BUDGET = 1_024;
const BROWSE_LATE_SENTINEL_INDEX = 99_000;
const MAX_MOUNTED_CELLS = 240;
const MAX_FAR_DRAG_PAGE_DELTA = 1;
const TASK_TEMP_DIR = path.resolve(".tmp-tests/w2-11-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w2-11-browser-gate");

process.env.TEMP = TASK_TEMP_DIR;
process.env.TMP = TASK_TEMP_DIR;
process.env.TMPDIR = TASK_TEMP_DIR;
await mkdir(TASK_TEMP_DIR, { recursive: true });
await mkdir(ARTIFACT_DIR, { recursive: true });

const server = await createServer({
  configFile: path.resolve("vite.config.ts"),
  server: { host: "127.0.0.1", port: 0, strictPort: false }
});
await server.listen();
const baseUrl = server.resolvedUrls?.local?.[0]?.replace(/\/$/u, "");
if (!baseUrl) throw new Error("Vite did not expose a local browser URL.");

const browser = await chromium.launch({
  headless: true,
  ...(process.env.W211_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W211_CHROMIUM_EXECUTABLE } : {})
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function installInstrumentation(context) {
  await context.addInitScript(() => {
    localStorage.setItem("zc-onboarding-complete", "true");
    localStorage.setItem("zc-language", "en");
    const state = {
      ...{
        browsePageCalls: 0,
        browsePageLengths: [],
        browseScanEnds: [],
        browseQueries: [],
        browseFirstPageSnapshots: [],
        browseSessionsCreated: 0,
        browseSessionsDisposed: 0,
        libraryPageCalls: 0,
        libraryPageLengths: [],
        libraryQueries: [],
        libraryFingerprints: [],
        librarySnapshotRevisions: [],
        selectionSummaries: [],
        thumbnailRequests: 0,
        thumbnailCancels: 0,
        activeThumbnailRequests: 0,
        thumbnailVariants: []
      },
      lifecycle: {
        listenerAdds: 0,
        listenerRemoves: 0,
        resizeObservers: 0,
        resizeObserverCreates: 0,
        resizeObserverDisconnects: 0,
        mutationObservers: 0,
        intersectionObservers: 0,
        activeTimers: 0,
        objectUrlsCreated: 0,
        objectUrlsRevoked: 0
      }
    };
    Object.defineProperty(window, "__zcW211", { value: state, writable: true, configurable: true });
    const lifecycle = state.lifecycle;
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (...args) {
      lifecycle.listenerAdds += 1;
      return originalAdd.apply(this, args);
    };
    EventTarget.prototype.removeEventListener = function (...args) {
      lifecycle.listenerRemoves += 1;
      return originalRemove.apply(this, args);
    };

    const wrapObserverMethods = (name, counter) => {
      const Original = window[name];
      if (typeof Original !== "function" || !Original.prototype?.observe || !Original.prototype?.disconnect) return;
      const originalObserve = Original.prototype.observe;
      const originalDisconnect = Original.prototype.disconnect;
      const originalUnobserve = Original.prototype.unobserve;
      const observedTargets = new WeakMap();
      const adjustActive = (delta) => {
        if (delta > 0) {
          lifecycle[counter] += 1;
          if (counter === "resizeObservers") lifecycle.resizeObserverCreates += 1;
        } else {
          lifecycle[counter] = Math.max(0, lifecycle[counter] - 1);
          if (counter === "resizeObservers") lifecycle.resizeObserverDisconnects += 1;
        }
      };
      Original.prototype.observe = function (...args) {
        const result = originalObserve.apply(this, args);
        const target = args[0];
        if (target && typeof target === "object") {
          let targets = observedTargets.get(this);
          if (!targets) {
            targets = new Set();
            observedTargets.set(this, targets);
          }
          if (targets.size === 0) adjustActive(1);
          targets.add(target);
        }
        return result;
      };
      if (typeof originalUnobserve === "function") {
        Original.prototype.unobserve = function (...args) {
          const result = originalUnobserve.apply(this, args);
          const targets = observedTargets.get(this);
          if (targets) {
            targets.delete(args[0]);
            if (targets.size === 0) adjustActive(-1);
          }
          return result;
        };
      }
      Original.prototype.disconnect = function (...args) {
        const targets = observedTargets.get(this);
        if (targets?.size) {
          targets.clear();
          adjustActive(-1);
        }
        return originalDisconnect.apply(this, args);
      };
    };
    wrapObserverMethods("ResizeObserver", "resizeObservers");
    wrapObserverMethods("MutationObserver", "mutationObservers");
    wrapObserverMethods("IntersectionObserver", "intersectionObservers");

    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    const activeTimers = new Set();
    window.setTimeout = (callback, delay, ...args) => {
      let timerId;
      timerId = originalSetTimeout(() => {
        activeTimers.delete(timerId);
        lifecycle.activeTimers = activeTimers.size;
        callback(...args);
      }, delay);
      activeTimers.add(timerId);
      lifecycle.activeTimers = activeTimers.size;
      return timerId;
    };
    window.clearTimeout = (timerId) => {
      activeTimers.delete(timerId);
      lifecycle.activeTimers = activeTimers.size;
      return originalClearTimeout(timerId);
    };

    if (typeof URL.createObjectURL === "function" && typeof URL.revokeObjectURL === "function") {
      const originalCreate = URL.createObjectURL.bind(URL);
      const originalRevoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (value) => {
        lifecycle.objectUrlsCreated += 1;
        return originalCreate(value);
      };
      URL.revokeObjectURL = (value) => {
        lifecycle.objectUrlsRevoked += 1;
        return originalRevoke(value);
      };
    }
  });
}

async function readStats(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__zcW211 ?? {})));
}

async function readResourceSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__zcW211 ?? {};
    const lifecycle = state.lifecycle ?? {};
    return {
      domNodes: document.querySelectorAll("*").length,
      listenerAdds: lifecycle.listenerAdds ?? 0,
      listenerRemoves: lifecycle.listenerRemoves ?? 0,
      listenerNet: (lifecycle.listenerAdds ?? 0) - (lifecycle.listenerRemoves ?? 0),
      resizeObservers: lifecycle.resizeObservers ?? 0,
      resizeObserverCreates: lifecycle.resizeObserverCreates ?? 0,
      resizeObserverDisconnects: lifecycle.resizeObserverDisconnects ?? 0,
      mutationObservers: lifecycle.mutationObservers ?? 0,
      intersectionObservers: lifecycle.intersectionObservers ?? 0,
      activeTimers: lifecycle.activeTimers ?? 0,
      objectUrlsCreated: lifecycle.objectUrlsCreated ?? 0,
      objectUrlsRevoked: lifecycle.objectUrlsRevoked ?? 0,
      activeThumbnailRequests: state.activeThumbnailRequests ?? 0
    };
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > window.innerWidth + 1,
    body: document.body.scrollWidth > window.innerWidth + 1,
    workspaces: [...document.querySelectorAll(".file-library-workspace")]
      .some((element) => element.scrollWidth > element.clientWidth + 1),
    grids: [...document.querySelectorAll('[data-shared-file-grid="true"]')]
      .some((element) => element.scrollWidth > element.clientWidth + 1)
  }));
  assert(!overflow.document && !overflow.body && !overflow.workspaces && !overflow.grids,
    `${label}: horizontal overflow ${JSON.stringify(overflow)}`);
  return overflow;
}

async function openLibrary(page) {
  await page.getByRole("button", { name: "File Library", exact: true }).click();
  await page.waitForSelector('.file-library-workspace[data-mode="library"]');
  const allIndexedFiles = page.getByRole("button", { name: "View all indexed files", exact: true });
  if (await allIndexedFiles.count() > 0 && await allIndexedFiles.first().isVisible()) {
    await allIndexedFiles.first().click();
  }
  const search = page.locator('[data-file-library-command-search="true"] [data-file-library-local-search="true"]');
  await search.waitFor({ state: "visible" });
  const list = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="library"]');
  await list.waitFor({ state: "visible" });
  await page.waitForFunction((total) => document.querySelector('[data-shared-file-list-source="library"]')
    ?.getAttribute("data-file-library-logical-count") === String(total), LIBRARY_TOTAL);
  return { search, list };
}

async function waitForLibraryCount(page, count) {
  await page.waitForFunction((expected) => document.querySelector('[data-shared-file-list-source="library"]')
    ?.getAttribute("data-file-library-logical-count") === String(expected), count);
}

async function switchView(page, view) {
  await page.getByRole("button", { name: view === "grid" ? "Grid" : "List", exact: true }).click();
  const selector = view === "grid"
    ? '[data-shared-file-grid="true"]'
    : '[data-shared-file-list="true"]';
  await page.locator(selector).filter({ visible: true }).first().waitFor({ state: "visible" });
}

async function openBrowseRoot(page) {
  await page.getByRole("tab", { name: "Browse", exact: true }).click();
  await page.waitForSelector('.file-library-workspace[data-mode="browse"]');
  const currentFolder = page.locator('[data-browse-state="current-folder"]');
  if (await currentFolder.count() === 0) {
    const openLocation = page.locator('[data-browse-location-action="open"]');
    await openLocation.first().click();
  }
  await currentFolder.waitFor({ state: "visible" });
  const list = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
  await list.waitFor({ state: "visible" });
  return list;
}

async function browseLoadMoreButton(list) {
  return list.locator("xpath=..")
    .getByRole("button", { name: /Load/i })
    .first();
}

async function runIntegratedScene(viewport, deviceScaleFactor) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  await installInstrumentation(context);
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const metrics = {
    viewport,
    deviceScaleFactor,
    sourceHead: SOURCE_HEAD,
    actualSha: ACTUAL_CHECKOUT_SHA,
    actualTree: ACTUAL_CHECKOUT_TREE,
    fixture: {
      seed: "w2-11-fixed-index-v1",
      libraryTotal: LIBRARY_TOTAL,
      browseTotal: BROWSE_TOTAL,
      browseScanBudget: BROWSE_SCAN_BUDGET,
      lateSentinelIndex: BROWSE_LATE_SENTINEL_INDEX
    },
    firstUsefulContentMs: {},
    virtualization: {},
    browse: {},
    history: {},
    resources: {}
  };

  try {
    await page.goto(`${baseUrl}?${FIXTURE_QUERY}`, { waitUntil: "commit" });
    const libraryStart = Date.now();
    const { search, list } = await openLibrary(page);
    await list.locator('[role="option"]').first().waitFor({ state: "visible" });
    metrics.firstUsefulContentMs.library = Date.now() - libraryStart;
    assert(metrics.firstUsefulContentMs.library >= 0, "Library first useful content measurement was invalid");
    assert(await list.locator('[role="option"]').count() > 0, "Library did not expose a first usable row");
    await page.waitForTimeout(150);
    const resourceBaseline = await readResourceSnapshot(page);
    metrics.resources.baseline = resourceBaseline;

    const initialListRows = await list.locator('[role="option"]').count();
    assert(initialListRows < MAX_MOUNTED_CELLS, `Library List mounted too many rows: ${initialListRows}`);
    await list.focus();
    await page.keyboard.press("Control+A");
    await page.waitForSelector('[data-library-selection-kind="all_matching"]');
    await page.waitForFunction(() => (window.__zcW211?.selectionSummaries ?? [])
      .some((summary) => summary.count === 100000));
    const selectionStats = await readStats(page);
    assert(selectionStats.selectionSummaries?.at(-1)?.count === LIBRARY_TOTAL,
      `all_matching summary was not exact 100k: ${JSON.stringify(selectionStats.selectionSummaries)}`);
    assert(selectionStats.selectionSummaries?.at(-1)?.queryFingerprint,
      "all_matching selection summary did not retain query fingerprint");
    assert(typeof selectionStats.selectionSummaries?.at(-1)?.snapshotRevision === "number",
      "all_matching selection summary did not retain snapshot revision");

    await switchView(page, "grid");
    const grid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="library"]');
    await page.waitForFunction((total) => document.querySelector('[data-shared-file-grid-source="library"]')
      ?.getAttribute("data-file-library-grid-logical-count") === String(total), LIBRARY_TOTAL);
    const initialGridCells = await grid.locator('[data-grid-cell="true"]').count();
    const initialGridRows = Number(await grid.getAttribute("data-file-library-grid-mounted-rows") ?? "0");
    assert(initialGridCells > 0 && initialGridCells < MAX_MOUNTED_CELLS,
      `Library Grid mounted-cell bound failed: ${initialGridCells}`);
    metrics.virtualization.library = { initialListRows, initialGridCells, initialGridRows };

    const statsBeforeFarDrag = await readStats(page);
    const pageCallsBeforeFarDrag = statsBeforeFarDrag.libraryPageCalls ?? 0;
    await grid.evaluate((element) => {
      element.scrollTop = 204 * 80_000;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForTimeout(120);
    const statsAfterFarDrag = await readStats(page);
    const farDragDelta = (statsAfterFarDrag.libraryPageCalls ?? 0) - pageCallsBeforeFarDrag;
    assert(farDragDelta <= MAX_FAR_DRAG_PAGE_DELTA,
      `Library Grid far jump drained pages: before=${pageCallsBeforeFarDrag} after=${statsAfterFarDrag.libraryPageCalls}`);
    const scrolledGridCells = await grid.locator('[data-grid-cell="true"]').count();
    assert(scrolledGridCells < MAX_MOUNTED_CELLS, `Library Grid mounted too many scrolled cells: ${scrolledGridCells}`);

    await switchView(page, "list");
    await page.waitForSelector('[data-library-selection-kind="all_matching"]');
    await search.fill("late");
    await page.waitForFunction(() => document.querySelector('[data-shared-file-list-source="library"]')
      ?.getAttribute("data-file-library-logical-count") === "256");
    const filteredStats = await readStats(page);
    assert(filteredStats.libraryQueries?.includes("late"), "Library filter query was not observed by the fixture");
    assert(await page.locator('[data-library-selection-kind="none"]').count() === 1,
      "LibrarySelectionV1 all_matching survived a query boundary change");
    assert(new Set(filteredStats.libraryFingerprints ?? []).size >= 2,
      "Query V2 fingerprint did not change across the filter boundary");
    await search.fill("");
    await waitForLibraryCount(page, LIBRARY_TOTAL);

    await search.fill("slow-a");
    await page.waitForTimeout(350);
    await search.fill("slow-b");
    await page.waitForFunction(() => document.querySelector('[data-file-library-local-search="true"]')?.value === "slow-b");
    await page.waitForFunction(() => (window.__zcW211?.libraryQueries ?? []).includes("slow-b"));
    await page.waitForTimeout(500);
    const rapidLibraryRows = await list.locator('[role="option"]').allTextContents();
    assert(rapidLibraryRows.some((row) => row.toLowerCase().includes("slow-b")),
      `Library query B did not publish a usable row: ${JSON.stringify(rapidLibraryRows)}`);
    assert(!rapidLibraryRows.some((row) => row.toLowerCase().includes("slow-a")),
      "Stale Library query A published into query B");
    await search.fill("");
    await waitForLibraryCount(page, LIBRARY_TOTAL);

    const browseStart = Date.now();
    const browseList = await openBrowseRoot(page);
    await browseList.locator('[role="option"]').first().waitFor({ state: "visible" });
    metrics.firstUsefulContentMs.browse = Date.now() - browseStart;
    const initialBrowseCells = await browseList.locator('[role="option"]').count();
    assert(initialBrowseCells > 0 && initialBrowseCells < MAX_MOUNTED_CELLS,
      `Browse first page mounted too many rows: ${initialBrowseCells}`);
    const initialBrowseStats = await readStats(page);
    const ordinarySnapshot = (initialBrowseStats.browseFirstPageSnapshots ?? []).find((item) => item.query === "");
    assert(ordinarySnapshot?.completion === "partial" && ordinarySnapshot.hasCursor,
      `Browse 100k did not publish a progressive partial first page: ${JSON.stringify(ordinarySnapshot)}`);
    assert(ordinarySnapshot.entries <= 32, `Browse first page exceeded page bound: ${ordinarySnapshot.entries}`);
    assert(Number(await browseList.getAttribute("data-browse-logical-count")) <= 32,
      "Browse exposed a non-authoritative large count before completion");

    await browseList.evaluate((element) => {
      element.scrollTop = 44 * 100_000;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForTimeout(100);
    const afterBrowseFarDrag = await readStats(page);
    const ordinaryCalls = (afterBrowseFarDrag.browseQueries ?? []).filter((query) => query === "").length;
    assert(ordinaryCalls <= 2, `Browse far jump requested unbounded pages: ${ordinaryCalls}`);

    await switchView(page, "grid");
    const browseGrid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="browse"]');
    const browseGridCells = await browseGrid.locator('[data-grid-cell="true"]').count();
    assert(browseGridCells > 0 && browseGridCells < MAX_MOUNTED_CELLS,
      `Browse Grid mounted too many cells: ${browseGridCells}`);
    const childFolder = page.getByRole("gridcell", { name: /w2-11-child-folder/ }).first();
    await childFolder.dblclick();
    await page.waitForFunction(() => document.querySelectorAll('[data-browse-breadcrumbs="true"] button').length >= 2);
    await page.waitForSelector('[data-browse-known-count="8"]');
    const childKnownCount = await page.locator('[data-browse-known-count]').getAttribute("data-browse-known-count").catch(() => null);
    assert(childKnownCount === "8", `Browse child did not restore exact known count: ${childKnownCount}`);
    const breadcrumbs = page.locator('[data-browse-breadcrumbs="true"] button');
    await breadcrumbs.first().click();
    await page.waitForFunction(() => document.querySelector('[data-browse-enumeration-completion]')?.getAttribute("data-browse-enumeration-completion") === "partial");

    await switchView(page, "list");
    const browseSearch = page.locator('[data-file-library-command-search="true"] [data-file-library-local-search="true"]');
    await browseSearch.fill("impossible-match");
    await page.waitForFunction(() => document.querySelector('[data-browse-query="impossible-match"]') !== null);
    await page.waitForFunction(() => document.querySelector('[data-browse-enumeration-completion]')
      ?.getAttribute("data-browse-enumeration-completion") === "complete");
    const impossibleStats = await readStats(page);
    const impossibleFirst = (impossibleStats.browseFirstPageSnapshots ?? [])
      .find((item) => item.query === "impossible-match");
    assert(impossibleFirst?.completion === "partial" && impossibleFirst.entries === 0 && impossibleFirst.hasCursor,
      `Impossible Browse query was not bounded/partial on its first response: ${JSON.stringify(impossibleFirst)}`);
    assert(impossibleStats.browseScanEnds?.filter((end, index) => impossibleStats.browseQueries?.[index] === "impossible-match")
      .every((end) => end <= BROWSE_TOTAL), "Impossible Browse scan crossed the logical fixture boundary");

    await browseSearch.fill("late-sentinel");
    await page.waitForFunction(() => document.querySelector('[data-browse-query="late-sentinel"]') !== null);
    await page.getByText(/late-sentinel-\d+\.txt/).first().waitFor({ state: "visible" });
    const lateStats = await readStats(page);
    const lateSnapshots = (lateStats.browseFirstPageSnapshots ?? []).filter((item) => item.query === "late-sentinel");
    assert(lateSnapshots.some((item) => item.completion === "partial" && item.entries === 0 && item.hasCursor),
      "Late-sentinel query did not show a bounded empty partial turn");
    assert(lateSnapshots.some((item) => item.completion === "partial" && item.entries === 1),
      "Late-sentinel query did not publish the sentinel progressively");
    const lateLoadMore = await browseLoadMoreButton(browseList);
    for (let turn = 0; turn < 3; turn += 1) {
      const completion = await page.locator('[data-browse-enumeration-completion]').getAttribute("data-browse-enumeration-completion");
      if (completion === "complete") break;
      await lateLoadMore.click();
      await page.waitForTimeout(60);
    }
    await page.waitForFunction(() => document.querySelector('[data-browse-enumeration-completion]')
      ?.getAttribute("data-browse-enumeration-completion") === "complete");
    assert(await page.locator('[data-browse-known-count="1"]').count() === 1,
      "Browse knownCount was not exact only at late-sentinel EOF");

    await browseSearch.fill("slow-a");
    await page.waitForTimeout(350);
    await browseSearch.fill("slow-b");
    await page.waitForFunction(() => document.querySelector('[data-browse-query="slow-b"]') !== null);
    await page.getByText(/slow-b-\d+\.txt/).first().waitFor({ state: "visible" });
    await page.waitForTimeout(600);
    const rapidBrowseRows = await page.locator('[data-shared-file-list-source="browse"] [role="option"]').allTextContents();
    assert(!rapidBrowseRows.some((row) => row.toLowerCase().includes("slow-a")),
      "Stale Browse query A published into query B");
    assert(rapidBrowseRows.some((row) => row.toLowerCase().includes("slow-b")),
      "Browse query B did not remain current after query A completed late");

    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="browse"]').waitFor({ state: "visible" });
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByRole("tab", { name: "Library", exact: true }).click();
    await waitForLibraryCount(page, LIBRARY_TOTAL);
    await page.getByRole("tab", { name: "Browse", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-browse-query]')?.getAttribute("data-browse-query") === "slow-b");
    const backButton = page.getByRole("button", { name: "Back", exact: true });
    const forwardButton = page.getByRole("button", { name: "Forward", exact: true });
    if (await backButton.isEnabled()) {
      await backButton.click();
      await page.waitForTimeout(100);
      if (await forwardButton.isEnabled()) await forwardButton.click();
      await page.waitForFunction(() => document.querySelector('.file-library-workspace[data-mode="browse"]') !== null);
    }
    metrics.history = { browseQueryAfterSwitch: await page.locator('[data-browse-query]').getAttribute("data-browse-query") };

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.getByRole("button", { name: cycle % 2 ? "Grid" : "List", exact: true }).click();
      await page.getByRole("tab", { name: "Library", exact: true }).click();
      await waitForLibraryCount(page, LIBRARY_TOTAL);
      await page.getByRole("tab", { name: "Browse", exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.file-library-workspace[data-mode="browse"]') !== null);
    }
    await page.waitForTimeout(250);
    const finalResources = await readResourceSnapshot(page);
    metrics.resources = {
      baseline: resourceBaseline,
      final: finalResources,
      stats: await readStats(page)
    };
    assert(finalResources.activeThumbnailRequests === 0,
      `Thumbnail work did not quiesce: ${JSON.stringify(finalResources)}`);
    assert(finalResources.domNodes <= resourceBaseline.domNodes + 400,
      `DOM grew beyond the fixed baseline tolerance: baseline=${resourceBaseline.domNodes} final=${finalResources.domNodes}`);
    assert(finalResources.resizeObservers <= resourceBaseline.resizeObservers + 6
      && finalResources.mutationObservers <= resourceBaseline.mutationObservers + 6
      && finalResources.intersectionObservers <= resourceBaseline.intersectionObservers + 6,
    `Observer counts grew beyond fixed baseline tolerance: baseline=${JSON.stringify(resourceBaseline)} final=${JSON.stringify(finalResources)}`);
    assert(finalResources.activeTimers <= resourceBaseline.activeTimers + 20,
      `Timer count grew beyond fixed baseline tolerance: baseline=${resourceBaseline.activeTimers} final=${finalResources.activeTimers}`);
    assert(finalResources.objectUrlsCreated - finalResources.objectUrlsRevoked < 40,
      `Object URL steady state exceeded fixed tolerance: ${JSON.stringify(finalResources)}`);
    assert((metrics.resources.stats.thumbnailRequests ?? 0) > 0,
      "Integrated stress scene did not exercise thumbnail requests");
    assert((metrics.resources.stats.thumbnailCancels ?? 0) > 0,
      "Integrated stress scene did not exercise thumbnail cancellation");
    assert((metrics.resources.stats.thumbnailVariants ?? []).length > 0,
      "Integrated stress scene did not record thumbnail variants");
    await assertNoHorizontalOverflow(page, `${viewport.width}x${viewport.height}@${deviceScaleFactor}`);
    assert(consoleErrors.length === 0 && pageErrors.length === 0,
      `Browser console/page errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
    return metrics;
  } catch (error) {
    metrics.failure = String(error);
    metrics.resources = await readResourceSnapshot(page).catch(() => ({}));
    metrics.fixtureStats = await readStats(page).catch(() => ({}));
    const artifactStem = `w2-11-${viewport.width}x${viewport.height}-dpr-${String(deviceScaleFactor).replace(".", "_")}`;
    await writeFile(path.join(ARTIFACT_DIR, `${artifactStem}.json`), JSON.stringify(metrics, null, 2), "utf8");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${artifactStem}.png`), fullPage: false }).catch(() => undefined);
    throw error;
  } finally {
    await context.close();
  }
}

async function runDprProbe(viewport, deviceScaleFactor) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  await installInstrumentation(context);
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  try {
    await page.goto(`${baseUrl}?${FIXTURE_QUERY}`, { waitUntil: "commit" });
    await openLibrary(page);
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    const grid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="library"]');
    await grid.waitFor({ state: "visible" });
    await page.waitForFunction((total) => document.querySelector('[data-shared-file-grid-source="library"]')
      ?.getAttribute("data-file-library-grid-logical-count") === String(total), LIBRARY_TOTAL);
    const mountedCells = await grid.locator('[data-grid-cell="true"]').count();
    const columns = Number(await grid.getAttribute("data-file-library-grid-columns") ?? "0");
    assert(columns > 0, `DPR probe did not calculate grid columns at ${deviceScaleFactor}`);
    assert(mountedCells > 0 && mountedCells < MAX_MOUNTED_CELLS,
      `DPR probe mounted-cell bound failed at ${deviceScaleFactor}: ${mountedCells}`);
    const stats = await readStats(page);
    assert((stats.thumbnailVariants ?? []).length > 0, `DPR probe did not request a thumbnail at ${deviceScaleFactor}`);
    const overflow = await assertNoHorizontalOverflow(page, `${viewport.width}x${viewport.height}@${deviceScaleFactor}`);
    return { viewport, deviceScaleFactor, columns, mountedCells, variants: stats.thumbnailVariants, overflow };
  } finally {
    await context.close();
  }
}

let passed = false;
try {
  const results = [
    await runIntegratedScene({ width: 1600, height: 900 }, 1),
    await runIntegratedScene({ width: 980, height: 680 }, 1),
    await runDprProbe({ width: 1600, height: 900 }, 1.25),
    await runDprProbe({ width: 980, height: 680 }, 2)
  ];
  passed = true;
  const integratedSummary = results.slice(0, 2).map((result) => {
    const stats = result.resources.stats;
    return {
      viewport: result.viewport,
      deviceScaleFactor: result.deviceScaleFactor,
      firstUsefulContentMs: result.firstUsefulContentMs,
      virtualization: result.virtualization,
      resources: {
        baseline: result.resources.baseline,
        final: result.resources.final
      },
      fixture: {
        libraryPageCalls: stats.libraryPageCalls,
        libraryPageLengths: stats.libraryPageLengths,
        browsePageCalls: stats.browsePageCalls,
        maxBrowsePageLength: Math.max(0, ...(stats.browsePageLengths ?? [])),
        maxBrowseScanEnd: Math.max(0, ...(stats.browseScanEnds ?? [])),
        browseSessionsCreated: stats.browseSessionsCreated,
        browseSessionsDisposed: stats.browseSessionsDisposed,
        thumbnailRequests: stats.thumbnailRequests,
        thumbnailCancels: stats.thumbnailCancels,
        activeThumbnailRequests: stats.activeThumbnailRequests,
        thumbnailVariants: [...new Set(stats.thumbnailVariants ?? [])]
      }
    };
  });
  console.log(`[w2-11-real] METRICS ${JSON.stringify({ integrated: integratedSummary, dpr: results.slice(2) })}`);
  for (const result of results) {
    console.log(`[w2-11-real] PASS ${result.viewport.width}x${result.viewport.height}@${result.deviceScaleFactor} sourceHead=${result.sourceHead ?? SOURCE_HEAD} actualSha=${result.actualSha ?? ACTUAL_CHECKOUT_SHA} tree=${result.actualTree ?? ACTUAL_CHECKOUT_TREE}`);
  }
} finally {
  await browser.close();
  await server.close();
  await rm(TASK_TEMP_DIR, { recursive: true, force: true });
  if (passed) await rm(ARTIFACT_DIR, { recursive: true, force: true });
}
