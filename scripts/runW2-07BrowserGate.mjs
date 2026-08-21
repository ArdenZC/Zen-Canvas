import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W207_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const TASK_TEMP_DIR = path.resolve(".tmp-tests/w2-07-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w2-07-browser-gate");

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
  ...(process.env.W207_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W207_CHROMIUM_EXECUTABLE } : {})
});

const checkout = { sourceHead: SOURCE_HEAD, actualSha: ACTUAL_CHECKOUT_SHA, actualTree: ACTUAL_CHECKOUT_TREE };

async function closeContext(page) {
  const workspace = page.locator(".file-library-workspace");
  const layout = await workspace.getAttribute("data-layout");
  if (layout === "large") {
    await page.locator('[data-file-library-context-panel][data-file-library-context-layout="inline"] [aria-label="Close context"]').click();
  } else {
    await page.locator('[data-side-sheet="true"] button[aria-label="Close context"]').click();
  }
  await page.waitForFunction(() => document.querySelector('.file-library-workspace')?.getAttribute("data-context-open") === "false");
}

async function openContext(page) {
  const toggle = page.locator('[data-file-library-context-toggle="true"]');
  await toggle.click();
  await page.waitForFunction(() => document.querySelector('.file-library-workspace')?.getAttribute("data-context-open") === "true");
  await page.locator('[data-file-library-context-panel="true"]').waitFor();
  return toggle;
}

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
    await page.goto(`${baseUrl}?w2-05-browser-fixture=interaction&w2-05-browser-stale=true&w2-04-browser-fixture=source-owner&w2-06-browser-fixture=grid`, { waitUntil: "commit" });
    await page.getByRole("button", { name: "File Library", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="library"]');

    const allIndexedFiles = page.getByRole("button", { name: "View all indexed files", exact: true });
    if (await allIndexedFiles.count() > 0 && await allIndexedFiles.first().isVisible()) await allIndexedFiles.first().click();

    const libraryList = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="library"]');
    await libraryList.waitFor({ state: "visible" });
    const libraryRows = libraryList.locator('[data-library-row]');
    await libraryRows.first().waitFor({ state: "visible" });
    const contextToggle = page.locator('[data-file-library-context-toggle="true"]');
    if (await contextToggle.getAttribute("aria-pressed") !== "false") throw new Error("Context was not closed by default");

    await libraryRows.first().click();
    await page.waitForSelector('[data-library-selection-kind="explicit"]');
    if (await page.locator('[data-file-library-context-panel="true"]').count() !== 0) throw new Error("Library selection implicitly opened Context");

    await openContext(page);
    await page.waitForSelector('[data-file-library-context-source="library"] [data-file-library-context-content="inspector"]');
    await closeContext(page);
    if (await libraryRows.first().getAttribute("aria-selected") !== "true") throw new Error("Closing Context cleared Library selection");

    const viewList = page.getByRole("button", { name: "List", exact: true });
    const viewGrid = page.getByRole("button", { name: "Grid", exact: true });
    await viewGrid.click();
    const libraryGrid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="library"]');
    await libraryGrid.waitFor({ state: "visible" });
    await openContext(page);
    await page.locator('[data-file-library-context-source="library"] [data-file-library-context-content="inspector"]').waitFor();
    const libraryLayout = await page.locator(".file-library-workspace").getAttribute("data-layout");
    if (libraryLayout === "large") {
      await libraryGrid.focus();
      await libraryGrid.press("Escape");
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForFunction(() => document.querySelector('.file-library-workspace')?.getAttribute("data-context-open") === "false");
    if (await page.locator('[data-library-selection-kind="explicit"]').count() !== 1) throw new Error("Library Grid Escape cleared selection while closing Context");
    await viewList.click();
    await libraryList.waitFor({ state: "visible" });

    await libraryRows.first().click();
    await libraryRows.nth(1).click({ modifiers: ["Control"] });
    await page.waitForFunction(() => document.querySelector('[data-library-selection-kind="explicit"] [data-shared-file-list="true"]') === null || document.querySelector('[data-library-selection-kind="explicit"]') !== null);
    await openContext(page);
    await page.waitForSelector('[data-file-library-context-source="library"] [data-file-library-context-content="selection-summary"]');

    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await page.waitForSelector('[data-library-selection-kind="none"]');
    if (await contextToggle.getAttribute("aria-pressed") !== "true") throw new Error("Clearing selection changed Context preference");
    if (await page.locator('[data-file-library-context-panel="true"]').count() !== 0) throw new Error("Empty Context content was not hidden");

    await libraryRows.first().click();
    await page.waitForSelector('[data-file-library-context-source="library"] [data-file-library-context-content="inspector"]');
    await closeContext(page);
    await libraryList.focus();
    await libraryList.press("Control+A");
    await page.waitForTimeout(100);
    await page.waitForSelector('[data-library-selection-kind="all_matching"]', { state: "attached" });
    await openContext(page);
    await page.waitForSelector('[data-file-library-context-source="library"] [data-file-library-context-content="selection-summary"]');
    const allMatchingContextText = await page.locator('[data-file-library-context-source="library"]').textContent();
    if (!allMatchingContextText?.includes("selected") || allMatchingContextText.includes("count pending")) throw new Error(`all_matching Context did not use the durable summary count: ${allMatchingContextText}`);
    await closeContext(page);

    await page.getByRole("tab", { name: "Browse", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="browse"][data-detached-browse="true"]');
    const locations = page.locator('[data-browse-location="true"]');
    await locations.first().waitFor();
    await locations.first().locator('[data-browse-location-action="open"]').click();
    await page.waitForSelector('[data-browse-state="current-folder"]');
    const browseList = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
    await browseList.waitFor({ state: "visible" });
    const browseRows = browseList.locator('[data-browse-entry="true"]');
    await browseRows.first().waitFor({ state: "visible" });
    if (await page.locator('[data-file-library-context-panel="true"]').count() !== 0) throw new Error("Library Context leaked into Browse");

    await browseRows.first().click();
    if (await page.locator('[data-file-library-context-panel="true"]').count() !== 0) throw new Error("Browse selection implicitly opened Context");
    const browseToggle = page.locator('[data-file-library-context-toggle="true"]');
    await browseToggle.click();
    await page.locator('[data-file-library-context-source="browse"] [data-file-library-context-content="inspector"]').waitFor();
    if (await page.locator('[data-file-library-context-panel="true"]').textContent().then((text) => text?.includes("displayPath"))) throw new Error("Browse Context exposed a raw path field");

    await closeContext(page);
    await browseRows.nth(1).click({ modifiers: ["Control"] });
    await page.waitForSelector('[data-browse-selection-count="2"]');
    await openContext(page);
    await page.locator('[data-file-library-context-source="browse"] [data-file-library-context-content="selection-summary"]').waitFor();
    const actualLayout = await page.locator(".file-library-workspace").getAttribute("data-layout");
    if (actualLayout === "large" && await page.locator('[data-file-library-context-panel][data-file-library-context-layout="inline"]').count() !== 1) throw new Error("Large Browse Context did not use an inline panel");
    if (actualLayout !== "large" && await page.locator('[data-file-library-context-panel][data-file-library-context-layout="overlay"]').count() !== 1) throw new Error("Medium/compact Browse Context did not use an overlay");

    if (actualLayout !== "large") {
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector('.file-library-workspace')?.getAttribute("data-context-open") === "false");
      if (await page.locator('[data-browse-selection-count="2"]').count() !== 1) throw new Error("Escape cleared Browse selection while closing Context");
      await page.waitForFunction(() => document.activeElement?.matches('[data-file-library-context-toggle="true"]') === true);
    } else {
      await closeContext(page);
      if (await page.locator('[data-browse-selection-count="2"]').count() !== 1) throw new Error("Closing Browse Context cleared selection");
    }

    await viewGrid.click();
    const browseGrid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="browse"]');
    await browseGrid.waitFor({ state: "visible" });
    await openContext(page);
    await page.locator('[data-file-library-context-source="browse"] [data-file-library-context-content="selection-summary"]').waitFor();
    if (actualLayout === "large") {
      await browseGrid.focus();
      await browseGrid.press("Escape");
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForFunction(() => document.querySelector('.file-library-workspace')?.getAttribute("data-context-open") === "false");
    if (await page.locator('[data-browse-selection-count="2"]').count() !== 1) throw new Error("Browse Grid Escape cleared selection while closing Context");
    if (actualLayout !== "large") {
      await page.waitForFunction(() => document.activeElement?.matches('[data-file-library-context-toggle="true"]') === true);
    }

    const overflow = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      bodyOverflow: document.body.scrollWidth > window.innerWidth + 1,
      contextOverflow: [...document.querySelectorAll('[data-file-library-context-panel="true"]')].some((element) => element.scrollWidth > element.clientWidth + 1)
    }));
    if (overflow.documentOverflow || overflow.bodyOverflow || overflow.contextOverflow) throw new Error(`unexpected horizontal overflow: ${JSON.stringify(overflow)}`);
    if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));

    return { viewport, layout: actualLayout, ...checkout, overflow };
  } finally {
    await context.close();
  }
}

try {
  const results = [
    await runScene({ width: 1600, height: 900 }),
    await runScene({ width: 980, height: 680 })
  ];
  for (const result of results) console.log(`[w2-07-real] PASS ${result.viewport.width}x${result.viewport.height} sourceHead=${result.sourceHead} actualSha=${result.actualSha} tree=${result.actualTree}`);
} finally {
  await browser.close();
  await server.close();
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await rm(TASK_TEMP_DIR, { recursive: true, force: true });
}
