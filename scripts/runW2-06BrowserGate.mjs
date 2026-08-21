import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W206_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const TASK_TEMP_DIR = path.resolve(".tmp-tests/w2-06-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w2-06-browser-gate");

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
const baseUrl = server.resolvedUrls?.local?.[0]?.replace(/\/$/, "");
if (!baseUrl) throw new Error("Vite did not expose a local browser URL.");

const browser = await chromium.launch({
  headless: true,
  ...(process.env.W206_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W206_CHROMIUM_EXECUTABLE } : {})
});

const checkout = { sourceHead: SOURCE_HEAD, actualSha: ACTUAL_CHECKOUT_SHA, actualTree: ACTUAL_CHECKOUT_TREE };

async function runScene(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem("zc-onboarding-complete", "true");
    window.localStorage.setItem("zc-language", "en");
    Object.defineProperty(window, "__zcW206LibraryPageCalls", { value: 0, writable: true, configurable: true });
    const thumbnailStats = { created: 0, revoked: 0 };
    Object.defineProperty(window, "__zcW206ThumbnailStats", { value: thumbnailStats, configurable: true });
    const createObjectUrl = URL.createObjectURL.bind(URL);
    const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (value) => {
      thumbnailStats.created += 1;
      return createObjectUrl(value);
    };
    URL.revokeObjectURL = (value) => {
      thumbnailStats.revoked += 1;
      return revokeObjectUrl(value);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  try {
    await page.goto(`${baseUrl}?w2-05-browser-fixture=interaction&w2-05-browser-stale=true&w2-04-browser-fixture=source-owner&w2-06-browser-fixture=grid`, { waitUntil: "commit" });
    await page.getByRole("button", { name: "File Library", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="library"]');

    const allIndexedFiles = page.getByRole("button", { name: "View all indexed files", exact: true });
    if (await allIndexedFiles.count() > 0 && await allIndexedFiles.first().isVisible()) await allIndexedFiles.first().click();

    const libraryList = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="library"]');
    await libraryList.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector('[data-shared-file-list-source="library"]')?.getAttribute("data-file-library-logical-count") === "100000");
    await libraryList.locator('[role="option"]').first().click();
    await page.waitForSelector('[data-library-selection-kind="explicit"]');
    await libraryList.focus();
    await libraryList.press("ArrowDown");

    await page.getByRole("button", { name: "Grid", exact: true }).click();
    const libraryGrid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="library"]');
    await libraryGrid.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector('[data-shared-file-grid-source="library"]')?.getAttribute("data-file-library-grid-logical-count") === "100000");
    await page.waitForTimeout(50);
    const pageCallsBeforeFarDrag = await page.evaluate(() => window.__zcW206LibraryPageCalls ?? 0);
    const initialCells = await libraryGrid.locator('[data-grid-cell="true"]').count();
    if (initialCells === 0 || initialCells >= 240) throw new Error(`Library Grid mounted-cell bound failed: ${initialCells}`);
    await libraryGrid.evaluate((element) => {
      element.scrollTop = 204 * 24;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForTimeout(20);
    const pageCallsAfterFarDrag = await page.evaluate(() => window.__zcW206LibraryPageCalls ?? 0);
    if (pageCallsAfterFarDrag - pageCallsBeforeFarDrag > 1) throw new Error(`Far Grid drag drained multiple pages: before=${pageCallsBeforeFarDrag} after=${pageCallsAfterFarDrag}`);
    const cancellationCount = await page.evaluate(() => (window).__zcW206ThumbnailCancels ?? 0);
    if (cancellationCount === 0) throw new Error("Rapid Grid scroll did not cancel an obsolete thumbnail request");
    await libraryGrid.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('[data-shared-file-grid-source="library"] [data-grid-cell-status="ready"]').length > 0);
    if (await page.locator('[data-library-selection-kind="explicit"]').count() !== 1) throw new Error("List selection did not survive List -> Grid");

    await libraryGrid.focus();
    await libraryGrid.press("ArrowDown");
    const focusedGridCell = await libraryGrid.getAttribute("aria-activedescendant");
    if (!focusedGridCell || await page.locator(`#${focusedGridCell}`).count() !== 1) throw new Error("Grid keyboard focus was not mounted");
    await libraryGrid.evaluate((element) => {
      element.scrollTop = 204 * 24;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForTimeout(150);
    const pageCallsAfterSecondFarDrag = await page.evaluate(() => window.__zcW206LibraryPageCalls ?? 0);
    await page.waitForTimeout(150);
    const settledFarDragCalls = await page.evaluate(() => window.__zcW206LibraryPageCalls ?? 0);
    if (settledFarDragCalls !== pageCallsAfterSecondFarDrag) throw new Error(`Far Grid drag continued paging after source update: ${pageCallsAfterSecondFarDrag} -> ${settledFarDragCalls}`);
    const scrolledCells = await libraryGrid.locator('[data-grid-cell="true"]').count();
    if (scrolledCells >= 240) throw new Error(`Library Grid mounted-cell bound failed after scroll: ${scrolledCells}`);
    const thumbnailStats = await page.evaluate(() => ({
      created: (window).__zcW206ThumbnailStats?.created ?? 0,
      revoked: (window).__zcW206ThumbnailStats?.revoked ?? 0
    }));
    if (thumbnailStats.created === 0 || thumbnailStats.revoked === 0) throw new Error(`Thumbnail object URL lifecycle was not exercised: ${JSON.stringify(thumbnailStats)}`);

    const pageCallsBeforeNearEnd = settledFarDragCalls;
    await libraryGrid.evaluate((element) => {
      const loadedCount = Number(element.getAttribute("data-file-library-grid-loaded-count") ?? "0");
      const columns = Number(element.getAttribute("data-file-library-grid-columns") ?? "1");
      const loadedBoundaryRow = Math.max(0, Math.ceil(loadedCount / Math.max(1, columns)) - 1);
      const visibleRows = Math.ceil(element.clientHeight / 204);
      const nearEndDemandRow = Math.max(0, loadedBoundaryRow - visibleRows - 1);
      element.scrollTop = 204 * nearEndDemandRow;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const pageCallsAfterNearEnd = await page.evaluate(() => window.__zcW206LibraryPageCalls ?? 0);
    if (pageCallsAfterNearEnd <= pageCallsBeforeNearEnd) {
      const gridState = await libraryGrid.evaluate((element) => ({
        loadedCount: element.getAttribute("data-file-library-grid-loaded-count"),
        columns: element.getAttribute("data-file-library-grid-columns"),
        mountedRows: element.getAttribute("data-file-library-grid-mounted-rows"),
        scrollTop: element.scrollTop,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      }));
      throw new Error(`Intentional near-end Grid scroll did not request another page: ${pageCallsBeforeNearEnd} -> ${pageCallsAfterNearEnd} state=${JSON.stringify(gridState)}`);
    }
    await page.waitForTimeout(150);
    const settledNearEndCalls = await page.evaluate(() => window.__zcW206LibraryPageCalls ?? 0);
    if (settledNearEndCalls !== pageCallsAfterNearEnd) throw new Error(`Near-end Grid demand repeatedly paged after source update: ${pageCallsAfterNearEnd} -> ${settledNearEndCalls}`);

    await page.getByRole("button", { name: "List", exact: true }).click();
    await libraryList.waitFor({ state: "visible" });
    if (await page.locator('[data-library-selection-kind="explicit"]').count() !== 1) throw new Error("Grid selection did not survive Grid -> List");
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await libraryGrid.waitFor({ state: "visible" });

    await page.getByRole("tab", { name: "Browse", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="browse"][data-detached-browse="true"]');
    await page.locator('[data-browse-location-action="open"]').first().click();
    await page.waitForSelector('[data-browse-state="current-folder"]');
    const browseList = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
    await browseList.waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    const browseGrid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="browse"]');
    await browseGrid.waitFor({ state: "visible" });
    await page.waitForSelector('[data-browse-grid-entry="true"]');
    if (await browseGrid.locator('[data-grid-cell-status="directory"]').count() !== 1) throw new Error("Browse directory placeholder was not rendered");
    await page.waitForFunction(() => document.querySelectorAll('[data-shared-file-grid-source="browse"] [data-grid-cell-status="ready"]').length > 0);
    await page.getByRole("gridcell", { name: /mock-folder/ }).dblclick();
    await page.waitForFunction(() => document.querySelectorAll('[data-browse-breadcrumbs="true"] button').length >= 2);
    // The child folder is a new target-specific history entry; explicitly
    // choose Grid there before checking source/target restoration.
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await page.waitForSelector('[data-shared-file-grid-source="browse"]');

    await page.getByRole("tab", { name: "Library", exact: true }).click();
    await page.waitForSelector('[data-shared-file-grid-source="library"]');
    await page.getByRole("tab", { name: "Browse", exact: true }).click();
    await page.waitForSelector('[data-shared-file-grid-source="browse"]');

    const overflow = await page.evaluate(() => ({
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      bodyOverflow: document.body.scrollWidth > window.innerWidth + 1,
      gridOverflow: [...document.querySelectorAll('[data-shared-file-grid="true"]')].some((element) => element.scrollWidth > element.clientWidth + 1)
    }));
    if (overflow.documentOverflow || overflow.bodyOverflow || overflow.gridOverflow) throw new Error(`unexpected horizontal overflow: ${JSON.stringify(overflow)}`);
    if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));
    return { viewport, ...checkout, initialCells, scrolledCells, overflow };
  } finally {
    await context.close();
  }
}

try {
  const results = [
    await runScene({ width: 1600, height: 900 }),
    await runScene({ width: 980, height: 680 })
  ];
  for (const result of results) console.log(`[w2-06-real] PASS ${result.viewport.width}x${result.viewport.height} sourceHead=${result.sourceHead} actualSha=${result.actualSha} tree=${result.actualTree} initialCells=${result.initialCells} scrolledCells=${result.scrolledCells}`);
} finally {
  await browser.close();
  await server.close();
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await rm(TASK_TEMP_DIR, { recursive: true, force: true });
}
