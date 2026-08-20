import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W205_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const TASK_TEMP_DIR = path.resolve(".tmp-tests/w2-05-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w2-05-browser-gate");

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
  ...(process.env.W205_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W205_CHROMIUM_EXECUTABLE } : {})
});

const checkout = { sourceHead: SOURCE_HEAD, actualSha: ACTUAL_CHECKOUT_SHA, actualTree: ACTUAL_CHECKOUT_TREE };

async function runScene(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem("zc-onboarding-complete", "true");
    window.localStorage.setItem("zc-language", "en");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  try {
    await page.goto(`${baseUrl}?w2-05-browser-fixture=interaction&w2-05-browser-stale=true&w2-04-browser-fixture=source-owner`, { waitUntil: "commit" });
    await page.getByRole("button", { name: "File Library", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="library"]');

    const allIndexedFiles = page.getByRole("button", { name: "View all indexed files", exact: true });
    if (await allIndexedFiles.count() > 0 && await allIndexedFiles.first().isVisible()) await allIndexedFiles.first().click();

    const libraryList = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="library"]');
    await libraryList.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector('[data-shared-file-list-source="library"]')?.getAttribute("data-file-library-logical-count") === "100000");
    const initialRows = await libraryList.locator('[role="option"]').count();
    if (initialRows === 0 || initialRows >= 100) throw new Error(`Library virtual row bound failed: ${initialRows}`);
    const staleRow = libraryList.locator('[data-library-row="w2-05-interaction-file-000001"]');
    await staleRow.waitFor({ state: "visible" });
    const staleWarning = staleRow.locator(".shared-file-list-warning");
    const staleWarningText = await staleWarning.textContent();
    if (await staleWarning.count() !== 1 || !staleWarningText?.includes("The file is no longer available in this scope")) {
      throw new Error("Library stale/missing presentation was not visible");
    }

    await libraryList.focus();
    await libraryList.press("Control+A");
    await page.waitForFunction(() => document.querySelector('[data-library-selection-kind="all_matching"]') !== null);
    if (await libraryList.getAttribute("data-file-library-logical-count") !== "100000") throw new Error("Library logical count changed after all_matching");

    await libraryList.press("ArrowDown");
    const focusedRowId = await libraryList.getAttribute("aria-activedescendant");
    if (!focusedRowId) throw new Error("No-focus ArrowDown did not establish logical focus");
    if (await libraryList.locator(`#${focusedRowId}`).count() !== 1) throw new Error("Focused row did not mount after ArrowDown");
    await libraryList.evaluate((element) => {
      element.scrollTop = 44 * 30;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForTimeout(100);
    const manuallyScrolledFocus = await libraryList.evaluate((element, rowId) => ({
      scrollTop: element.scrollTop,
      activeDescendant: element.getAttribute("aria-activedescendant"),
      focusedRowMounted: rowId ? document.getElementById(rowId) !== null : false
    }), focusedRowId);
    if (manuallyScrolledFocus.scrollTop <= 0 || manuallyScrolledFocus.focusedRowMounted || manuallyScrolledFocus.activeDescendant !== null) {
      throw new Error(`Manual scroll focus contract failed: ${JSON.stringify(manuallyScrolledFocus)}`);
    }
    await libraryList.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForTimeout(100);
    if (await libraryList.locator(`#${focusedRowId}.is-focused`).count() !== 1) throw new Error("Focused visual projection did not return after scrolling back");
    if (await libraryList.getAttribute("aria-activedescendant") !== focusedRowId) throw new Error("Mounted focused row was not restored as active descendant");

    const beforeScroll = await libraryList.evaluate((element) => element.scrollTop);
    await libraryList.press("PageDown");
    await page.waitForTimeout(150);
    const afterScroll = await libraryList.evaluate((element) => element.scrollTop);
    if (afterScroll <= beforeScroll) {
      const metrics = await libraryList.evaluate((element) => ({
        scrollTop: element.scrollTop,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        activeDescendant: element.getAttribute("aria-activedescendant")
      }));
      throw new Error(`Library keyboard paging did not scroll the shared list: ${JSON.stringify(metrics)}`);
    }
    const scrolledRows = await libraryList.locator('[role="option"]').count();
    if (scrolledRows >= 100) throw new Error(`Library mounted row bound failed after scroll: ${scrolledRows}`);
    if (await page.locator('[data-library-selection-kind="all_matching"]').count() !== 1) throw new Error("Library all_matching selection was not retained");

    await page.getByRole("tab", { name: "Browse", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="browse"][data-detached-browse="true"]');
    const locations = page.locator('[data-browse-location="true"]');
    await locations.first().waitFor();
    await locations.first().locator('[data-browse-location-action="open"]').click();
    await page.waitForSelector('[data-browse-state="current-folder"]');
    const browseList = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
    await browseList.waitFor({ state: "visible" });
    await page.waitForSelector('[data-browse-enumeration-completion="partial"]', { state: "attached" });
    if (await page.locator('[data-browse-entry="true"]').count() !== 2) throw new Error("Browse first page was not mounted by the shared list");

    await browseList.focus();
    await browseList.press("Control+A");
    await page.waitForFunction(() => document.querySelector('[data-browse-selection-count="2"]') !== null);
    await page.getByRole("button", { name: "Load more", exact: true }).click();
    await page.waitForSelector('[data-browse-enumeration-completion="complete"]');
    if (await page.locator('[data-browse-known-count="2"]').count() !== 1) throw new Error("Browse complete known count was not published");

    await page.getByRole("button", { name: "Open folder: mock-folder", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-browse-breadcrumbs="true"] button').length >= 2);
    await page.getByRole("tab", { name: "Library", exact: true }).click();
    await page.waitForSelector('[data-shared-file-list-source="library"]');
    if (await page.locator('[data-library-selection-kind="all_matching"]').count() !== 1) throw new Error("Browse selection leaked into Library or Library selection was lost");

    const overflow = await page.evaluate(() => ({
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      bodyOverflow: document.body.scrollWidth > window.innerWidth + 1,
      sharedListOverflow: [...document.querySelectorAll('[data-shared-file-list="true"]')].some((element) => element.scrollWidth > element.clientWidth + 1)
    }));
    if (overflow.documentOverflow || overflow.bodyOverflow || overflow.sharedListOverflow) throw new Error(`unexpected horizontal overflow: ${JSON.stringify(overflow)}`);
    if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));

    return { viewport, ...checkout, initialRows, scrolledRows, overflow };
  } finally {
    await context.close();
  }
}

try {
  const results = [
    await runScene({ width: 1600, height: 900 }),
    await runScene({ width: 980, height: 680 })
  ];
  for (const result of results) console.log(`[w2-05-real] PASS ${result.viewport.width}x${result.viewport.height} sourceHead=${result.sourceHead} actualSha=${result.actualSha} tree=${result.actualTree} initialRows=${result.initialRows} scrolledRows=${result.scrolledRows}`);
} finally {
  await browser.close();
  await server.close();
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await rm(TASK_TEMP_DIR, { recursive: true, force: true });
}
