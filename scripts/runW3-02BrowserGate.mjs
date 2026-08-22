import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { assertCheckoutEvidence } from "./ciEvidence.mjs";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W302_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const EXPECTED_CHECKOUT_SHA = process.env.W302_EXPECTED_CHECKOUT_SHA ?? null;
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
if (EXPECTED_CHECKOUT_SHA) assertCheckoutEvidence(EXPECTED_CHECKOUT_SHA, ACTUAL_CHECKOUT_SHA);

const TASK_TEMP_DIR = path.resolve(".tmp-tests/w3-02-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w3-02-browser-gate");
const FIXTURE_QUERY = "w3-02-browser-fixture=preview&w2-04-browser-fixture=source-owner&w2-05-browser-fixture=interaction&w2-09-browser-fixture=platform";

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
  ...(process.env.W302_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W302_CHROMIUM_EXECUTABLE } : {})
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > window.innerWidth + 1,
    body: document.body.scrollWidth > window.innerWidth + 1,
    workspace: [...document.querySelectorAll(".file-library-workspace")]
      .some((element) => element.scrollWidth > element.clientWidth + 1),
    preview: [...document.querySelectorAll('[data-preview-shell="true"]')]
      .some((element) => element.scrollWidth > element.clientWidth + 1)
  }));
  assert(!Object.values(overflow).some(Boolean), `${label}: horizontal overflow ${JSON.stringify(overflow)}`);
}

async function waitForLibrary(page) {
  await page.getByRole("button", { name: "File Library", exact: true }).click();
  await page.waitForSelector('.file-library-workspace[data-mode="library"]');
  const allIndexedFiles = page.getByRole("button", { name: "View all indexed files", exact: true });
  if (await allIndexedFiles.count() > 0 && await allIndexedFiles.first().isVisible()) await allIndexedFiles.first().click();
  const list = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="library"]');
  await list.waitFor({ state: "visible" });
  return list;
}

async function switchView(page, view) {
  await page.getByRole("button", { name: view === "grid" ? "Grid" : "List", exact: true }).click();
  const selector = view === "grid"
    ? '[data-shared-file-grid="true"][data-shared-file-grid-source="library"]'
    : '[data-shared-file-list="true"][data-shared-file-list-source="library"]';
  const surface = page.locator(selector);
  await surface.waitFor({ state: "visible" });
  return surface;
}

async function resolvePreview(page) {
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') !== null);
  await page.waitForFunction(() => {
    const shell = document.querySelector('[data-preview-shell="true"]');
    const pending = window.__zcW302?.pendingStartCount ?? 0;
    const state = shell?.getAttribute("data-preview-state");
    return pending > 0 && (state === "resolving" || state === "loading");
  });
  const pendingState = await page.evaluate(() => ({
    state: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state"),
    stats: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null,
    identity: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-identity")
  }));
  assert((pendingState.stats?.pendingStartCount ?? 0) > 0, `Preview did not reach deferred backend start: ${JSON.stringify(pendingState)}`);
  const shellState = await page.locator('[data-preview-shell="true"]').getAttribute("data-preview-state");
  assert(shellState === "resolving" || shellState === "loading", `Preview shell was not visible before backend completion: ${shellState}`);
  await page.evaluate(() => window.__zcW302?.resolveAll());
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") === "metadata_fallback");
  assert(await page.locator('[data-preview-shell="true"]').count() === 1, "Floating Preview rendered more than one host");
}

async function closePreview(page, surface) {
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') === null);
  const surfaceSelector = await surface.getAttribute("data-shared-file-list") === "true"
    ? '[data-shared-file-list="true"]'
    : '[data-shared-file-grid="true"]';
  await page.waitForFunction((selector) => document.activeElement?.matches(selector) === true, surfaceSelector);
}

async function assertSearchOwnsSpace(page) {
  const search = page.locator('[data-file-library-command-search="true"] [data-file-library-local-search="true"]');
  await search.waitFor({ state: "visible" });
  await search.focus();
  await page.keyboard.press("Space");
  assert(await page.locator('[data-preview-shell="true"]').count() === 0, "Search input did not retain Space ownership");
}

async function openPreviewFromSurface(page, surface) {
  await surface.focus();
  await page.keyboard.press("ArrowDown");
  const focusedState = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute("data-shared-file-list-source") ?? document.activeElement?.getAttribute("data-shared-file-grid-source") ?? null,
    activeDescendant: document.activeElement?.getAttribute("aria-activedescendant") ?? null,
    libraryProvenance: document.querySelector('[data-library-source-owner="query-v2"]')?.getAttribute("data-library-provenance") ?? null,
    options: document.querySelectorAll('[data-shared-file-list-source="library"] [role="option"]').length
  }));
  assert(focusedState.active !== null, `Preview source surface was not focused: ${JSON.stringify(focusedState)}`);
  await page.keyboard.press("Space");
  await resolvePreview(page);
}

async function rapidSwitchLibrarySources(page, surface) {
  const initialEpoch = Number(await page.locator('[data-preview-shell="true"]').getAttribute("data-preview-epoch"));
  await surface.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });
  await page.waitForFunction((epoch) => Number(document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-epoch")) > epoch, initialEpoch);
  await page.waitForFunction(() => (window.__zcW302?.pendingStartCount ?? 0) >= 1);
  await surface.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => (window.__zcW302?.pendingStartCount ?? 0) >= 2);
  await page.evaluate(() => window.__zcW302?.resolveAll());
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") === "metadata_fallback");
  const state = await page.evaluate(() => ({
    source: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-identity"),
    epoch: Number(document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-epoch")),
    lateStarts: window.__zcW302?.lateStarts ?? 0
  }));
  assert(state.epoch > initialEpoch, "Preview frontend epoch did not advance during source switching");
  assert(state.source && state.source !== "none", "Preview lost its final source identity after rapid switching");
  assert(state.lateStarts >= 1, "Fixture did not observe at least one late stale Preview result");
}

async function openBrowseLocation(page) {
  await page.getByRole("tab", { name: "Browse", exact: true }).click();
  await page.waitForSelector('.file-library-workspace[data-mode="browse"]');
  if (await page.locator('[data-browse-state="current-folder"]').count() === 0) {
    const openable = page.locator('[data-browse-location-openable="true"] [data-browse-location-action="open"]');
    await openable.first().waitFor({ state: "visible" });
    await openable.first().click();
  }
  await page.locator('[data-browse-state="current-folder"]').waitFor({ state: "visible" });
}

async function exerciseOverlayOwnership(page, surface) {
  if (await page.locator('[data-file-library-nav-toggle="true"]').getAttribute("aria-expanded") === "false"
    && await page.locator('.file-library-workspace').getAttribute("data-layout") === "compact") {
    const navigationToggle = page.locator('[data-file-library-nav-toggle="true"]');
    await navigationToggle.click();
    await page.waitForFunction(() => document.querySelector('[data-file-library-nav-toggle="true"]')?.getAttribute("aria-expanded") === "true");
    await page.locator('[data-side-sheet="true"]').waitFor({ state: "visible" });
    assert(await page.locator('[data-side-sheet="true"]').count() === 1, "Compact Navigation did not own the single modal overlay");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector('[data-file-library-nav-toggle="true"]')?.getAttribute("aria-expanded") === "false");
    await page.waitForFunction(() => document.activeElement?.matches('[data-file-library-nav-toggle="true"]') === true);
  }

  const contextToggle = page.locator('[data-file-library-context-toggle="true"]');
  await surface.locator('[role="option"]').first().click();
  await contextToggle.click();
  await page.waitForFunction(() => document.querySelector('.file-library-workspace')?.getAttribute("data-context-open") === "true");
  const previewAction = page.getByRole("button", { name: "Quick preview", exact: true });
  await previewAction.waitFor({ state: "visible" });
  await previewAction.click();
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') !== null);
  assert(await page.locator('[data-modal-layer="true"]').count() === 1, "Floating Preview did not replace the lower-priority context overlay");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') === null);

  await surface.locator('[role="option"]').first().click({ button: "right" });
  const contextMenu = page.getByRole("menu", { name: "File actions menu", exact: true });
  await contextMenu.waitFor({ state: "visible" });
  await contextMenu.getByRole("menuitem", { name: "Quick preview", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') !== null);
  assert(await page.getByRole("menu", { name: "File actions menu", exact: true }).count() === 0, "Floating Preview left the Context menu mounted");
  await resolvePreview(page);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') === null);
}

async function exerciseViewport(viewport) {
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
    await page.goto(`${baseUrl}?${FIXTURE_QUERY}`, { waitUntil: "commit" });
    const libraryList = await waitForLibrary(page);
    await assertSearchOwnsSpace(page);
    await openPreviewFromSurface(page, libraryList);
    await rapidSwitchLibrarySources(page, libraryList);
    await closePreview(page, libraryList);

    const libraryGrid = await switchView(page, "grid");
    await openPreviewFromSurface(page, libraryGrid);
    await closePreview(page, libraryGrid);

    await switchView(page, "list");
    await exerciseOverlayOwnership(page, libraryList);

    await openBrowseLocation(page);
    const browseList = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
    await browseList.waitFor({ state: "visible" });
    await openPreviewFromSurface(page, browseList);
    await closePreview(page, browseList);

    await page.getByRole("button", { name: "Grid", exact: true }).click();
    const browseGrid = page.locator('[data-shared-file-grid="true"][data-shared-file-grid-source="browse"]');
    await browseGrid.waitFor({ state: "visible" });
    await openPreviewFromSurface(page, browseGrid);
    await closePreview(page, browseGrid);

    await assertNoHorizontalOverflow(page, `${viewport.width}x${viewport.height}`);
    assert(consoleErrors.length === 0, `Console errors at ${viewport.width}x${viewport.height}: ${JSON.stringify(consoleErrors)}`);
    assert(pageErrors.length === 0, `Page errors at ${viewport.width}x${viewport.height}: ${JSON.stringify(pageErrors)}`);
    const stats = await page.evaluate(() => JSON.parse(JSON.stringify(window.__zcW302 ?? {})));
    await writeFile(path.join(ARTIFACT_DIR, `viewport-${viewport.width}x${viewport.height}.json`), JSON.stringify({
      sourceHead: SOURCE_HEAD,
      actualCheckoutSha: ACTUAL_CHECKOUT_SHA,
      actualCheckoutTree: ACTUAL_CHECKOUT_TREE,
      viewport,
      stats
    }, null, 2));
    console.log(`[w3-02-real] PASS ${viewport.width}x${viewport.height} sourceHead=${SOURCE_HEAD} actualSha=${ACTUAL_CHECKOUT_SHA} tree=${ACTUAL_CHECKOUT_TREE}`);
  } finally {
    await context.close();
  }
}

try {
  await exerciseViewport({ width: 1600, height: 900 });
  await exerciseViewport({ width: 980, height: 680 });
} finally {
  await browser.close();
  await server.close();
  await rm(ARTIFACT_DIR, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  await rm(TASK_TEMP_DIR, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
