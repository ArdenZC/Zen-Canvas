import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { assertCheckoutEvidence } from "./ciEvidence.mjs";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W303_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const EXPECTED_CHECKOUT_SHA = process.env.W303_EXPECTED_CHECKOUT_SHA ?? null;
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
if (EXPECTED_CHECKOUT_SHA) assertCheckoutEvidence(EXPECTED_CHECKOUT_SHA, ACTUAL_CHECKOUT_SHA);

const TASK_TEMP_DIR = path.resolve(".tmp-tests/w3-03-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w3-03-browser-gate");
const FIXTURE_QUERY = "w3-02-browser-fixture=preview&w3-03-browser-fixture=pinned&w2-04-browser-fixture=source-owner&w2-05-browser-fixture=interaction&w2-09-browser-fixture=platform";

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
  ...(process.env.W303_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W303_CHROMIUM_EXECUTABLE } : {})
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function tick(page) {
  await page.evaluate(() => Promise.resolve());
}

async function assertPageIdentity(page, label) {
  await page.waitForSelector("#root");
  await page.waitForFunction(() => document.title.trim().length > 0 && document.body.textContent?.trim().length > 0);
  const identity = await page.evaluate(() => ({
    title: document.title,
    bodyTextLength: document.body.textContent?.trim().length ?? 0,
    frameworkOverlay: Boolean(document.querySelector("vite-error-overlay, .vite-error-overlay"))
  }));
  assert(identity.title.includes("Zen"), `${label}: unexpected page title ${identity.title}`);
  assert(identity.bodyTextLength > 0, `${label}: blank application DOM`);
  assert(!identity.frameworkOverlay, `${label}: framework error overlay mounted`);
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

async function switchView(page, view, source) {
  await page.getByRole("button", { name: view === "grid" ? "Grid" : "List", exact: true }).click();
  const selector = view === "grid"
    ? `[data-shared-file-grid="true"][data-shared-file-grid-source="${source}"]`
    : `[data-shared-file-list="true"][data-shared-file-list-source="${source}"]`;
  const surface = page.locator(selector);
  await surface.waitFor({ state: "visible" });
  return surface;
}

async function resolveDeferredPreview(page, label) {
  await page.waitForFunction(() => {
    const shell = document.querySelector('[data-preview-shell="true"]');
    const pending = window.__zcW302?.pendingStartCount ?? 0;
    const state = shell?.getAttribute("data-preview-state");
    return pending > 0 && (state === "resolving" || state === "loading");
  });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.evaluate(() => window.__zcW302?.resolveAll());
    await tick(page);
    const state = await page.evaluate(() => ({
      pending: window.__zcW302?.pendingStartCount ?? 0,
      previewState: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null
    }));
    if (state.pending === 0 && state.previewState === "metadata_fallback") return;
  }
  const stats = await page.evaluate(() => (window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null));
  throw new Error(`${label}: deferred Preview did not settle ${JSON.stringify(stats)}`);
}

async function openFloating(page, surface, label) {
  await surface.focus();
  const activeDescendant = await surface.getAttribute("aria-activedescendant");
  if (activeDescendant === null) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector('[data-preview-host="zen-floating"]') !== null);
  const identity = await page.locator('[data-preview-host="zen-floating"]').getAttribute("data-preview-identity");
  assert(identity && identity !== "none", `${label}: Floating Preview has no source identity`);
  await resolveDeferredPreview(page, label);
  assert(await page.locator('[data-preview-host="zen-floating"]').count() === 1, `${label}: duplicate Floating hosts`);
  return identity;
}

async function assertSinglePinnedHost(page, label) {
  await page.waitForFunction(() => document.querySelector('[data-preview-host="zen-pinned"]') !== null
    && document.querySelectorAll('[data-preview-shell="true"]').length === 1
    && document.querySelector('[data-preview-host="zen-floating"]') === null);
  assert(await page.locator('[data-file-library-context-content="preview"]').count() === 1, `${label}: pinned host left Context ownership`);
  assert(await page.locator('[data-preview-host="zen-floating"]').count() === 0, `${label}: Floating host remained after Pin`);
}

async function pinFloating(page, viewport, label) {
  await page.locator('[data-preview-pin="true"]').click();
  await assertSinglePinnedHost(page, label);
  const layout = await page.locator(".file-library-workspace").getAttribute("data-layout");
  if (viewport.width <= 980) {
    await page.waitForFunction(() => document.querySelectorAll('[data-side-sheet="true"]').length === 1
      && document.querySelectorAll('[data-modal-layer="true"]').length === 1);
    assert(await page.locator('[data-side-sheet="true"]').count() === 1, `${label}: compact Context did not own one sheet`);
    assert(await page.locator('[data-modal-layer="true"]').count() === 1, `${label}: compact Pinned Preview created a second focus trap`);
  } else {
    assert(layout === "large", `${label}: expected large Context layout, got ${layout}`);
    assert(await page.locator('[data-file-library-context-layout="inline"] [data-preview-host="zen-pinned"]').count() === 1, `${label}: large Pinned Preview was not inline Context content`);
    assert(await page.locator('[data-modal-layer="true"]').count() === 0, `${label}: large Pinned Preview opened a modal layer`);
  }
  return page.locator('[data-preview-host="zen-pinned"]').getAttribute("data-preview-identity");
}

async function navigatePinned(page, direction, label) {
  const shell = page.locator('[data-preview-host="zen-pinned"]');
  const before = await shell.getAttribute("data-preview-identity");
  const button = page.locator(`button[data-preview-navigation="${direction}"]`);
  await button.waitFor({ state: "visible" });
  assert(!(await button.isDisabled()), `${label}: ${direction} was unexpectedly disabled`);
  await button.click();
  await page.waitForFunction((previous) => {
    const current = document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-identity");
    return current !== null && current !== previous && (window.__zcW302?.pendingStartCount ?? 0) > 0;
  }, before);
  await resolveDeferredPreview(page, label);
  const after = await shell.getAttribute("data-preview-identity");
  assert(after && after !== before, `${label}: ${direction} did not change the pinned source`);
  await assertSinglePinnedHost(page, label);
  return { before, after };
}

async function followSourceFocus(page, surface, label) {
  const before = await page.locator('[data-preview-host="zen-pinned"]').getAttribute("data-preview-identity");
  await surface.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });
  await page.waitForFunction((previous) => {
    const current = document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-identity");
    return current !== null && current !== previous && (window.__zcW302?.pendingStartCount ?? 0) > 0;
  }, before);
  await resolveDeferredPreview(page, label);
  const after = await page.locator('[data-preview-host="zen-pinned"]').getAttribute("data-preview-identity");
  assert(after && after !== before, `${label}: pinned Preview did not follow owner focus`);
}

async function unpin(page, label) {
  await page.locator('[data-preview-unpin="true"]').click();
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') === null);
  assert(await page.locator('[data-file-library-context-content="preview"]').count() === 0, `${label}: Preview content remained after Unpin`);
  const panelCount = await page.locator('[data-file-library-context-panel="true"]').count();
  if (panelCount > 0) {
    const contentKind = await page.locator("[data-file-library-context-content]").getAttribute("data-file-library-context-content");
    assert(contentKind === "inspector" || contentKind === "selection", `${label}: Context did not return to Inspector/selection: ${contentKind}`);
  }
}

async function openBrowseLocation(page) {
  if (await page.getByRole("tab", { name: "Browse", exact: true }).count() === 0) await waitForLibrary(page);
  await page.getByRole("tab", { name: "Browse", exact: true }).click();
  await page.waitForSelector('.file-library-workspace[data-mode="browse"]');
  if (await page.locator('[data-browse-state="current-folder"]').count() === 0) {
    const openable = page.locator('[data-browse-location-openable="true"] [data-browse-location-action="open"]');
    await openable.first().waitFor({ state: "visible" });
    await openable.first().click();
  }
  await page.locator('[data-browse-state="current-folder"]').waitFor({ state: "visible" });
}

async function runScenario(context, viewport, label, scenario, errors, evidence) {
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ label, kind: "console", text: message.text() });
  });
  page.on("pageerror", (error) => errors.push({ label, kind: "pageerror", text: String(error) }));
  try {
    await page.goto(`${baseUrl}?${FIXTURE_QUERY}`, { waitUntil: "commit" });
    await assertPageIdentity(page, label);
    await scenario(page);
    await assertNoHorizontalOverflow(page, `${label} ${viewport.width}x${viewport.height}`);
    const stats = await page.evaluate(() => ({
      fixture: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null,
      hosts: [...document.querySelectorAll('[data-preview-shell="true"]')].map((element) => ({
        host: element.getAttribute("data-preview-host"),
        state: element.getAttribute("data-preview-state"),
        identity: element.getAttribute("data-preview-identity")
      }))
    }));
    evidence.push({ label, stats });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${label}-${viewport.width}x${viewport.height}.png`), fullPage: true });
  } finally {
    await page.close();
  }
}

async function exerciseViewport(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem("zc-onboarding-complete", "true");
    window.localStorage.setItem("zc-language", "en");
  });
  const errors = [];
  const evidence = [];
  try {
    await runScenario(context, viewport, "library-list-pinned", async (page) => {
      const surface = await waitForLibrary(page);
      await surface.locator('[role="option"]').first().click();
      await openFloating(page, surface, "library list Floating");
      const first = await pinFloating(page, viewport, "library list Pin");
      const moved = await navigatePinned(page, "next", "library list Next");
      assert(moved.after !== first, "library list Next returned the same source");
      await navigatePinned(page, "previous", "library list Previous");
      await unpin(page, "library list Unpin");
    }, errors, evidence);

    await runScenario(context, viewport, "library-grid-source-follow", async (page) => {
      const list = await waitForLibrary(page);
      const surface = await switchView(page, "grid", "library");
      await surface.locator('[role="gridcell"]').first().click();
      await openFloating(page, surface, "library grid Floating");
      await pinFloating(page, viewport, "library grid Pin");
      await followSourceFocus(page, surface, "library grid source follow");
      await unpin(page, "library grid Unpin");
      assert(await list.count() === 0, "Library List remained mounted after Grid switch");
    }, errors, evidence);

    await runScenario(context, viewport, "browse-list-pinned", async (page) => {
      await openBrowseLocation(page);
      const surface = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
      await surface.waitFor({ state: "visible" });
      await openFloating(page, surface, "browse list Floating");
      await pinFloating(page, viewport, "browse list Pin");
      await navigatePinned(page, "next", "browse list Next");
      await unpin(page, "browse list Unpin");
    }, errors, evidence);

    await runScenario(context, viewport, "browse-grid-pinned", async (page) => {
      await openBrowseLocation(page);
      const surface = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
      await surface.waitFor({ state: "visible" });
      const grid = await switchView(page, "grid", "browse");
      await openFloating(page, grid, "browse grid Floating");
      await pinFloating(page, viewport, "browse grid Pin");
      await followSourceFocus(page, grid, "browse grid source follow");
      await unpin(page, "browse grid Unpin");
      assert(await surface.count() === 0, "Browse List remained mounted after Grid switch");
    }, errors, evidence);

    await runScenario(context, viewport, "pinned-no-source", async (page) => {
      const surface = await waitForLibrary(page);
      await openFloating(page, surface, "no-source Floating");
      const oldIdentity = await page.locator('[data-preview-host="zen-floating"]').getAttribute("data-preview-identity");
      await pinFloating(page, viewport, "no-source Pin");
      await page.locator('[data-file-library-mode="browse"]').evaluate((element) => (element instanceof HTMLElement ? element.click() : undefined));
      await page.waitForFunction((previous) => {
        const shell = document.querySelector('[data-preview-host="zen-pinned"]');
        return shell?.getAttribute("data-preview-identity") === "none"
          && shell.getAttribute("data-preview-state") === "no_source"
          && !document.querySelector(`[data-preview-identity="${previous}"]`)
          && document.querySelector('[data-preview-no-source="true"]') !== null;
      }, oldIdentity);
      await unpin(page, "no-source Unpin");
    }, errors, evidence);

    await runScenario(context, viewport, "pinned-rapid-latest-wins", async (page) => {
      const surface = await waitForLibrary(page);
      await openFloating(page, surface, "rapid Floating");
      await pinFloating(page, viewport, "rapid Pin");
      const baselineSwitches = await page.evaluate(() => window.__zcW302?.switchCalls ?? 0);
      const baselineLateStarts = await page.evaluate(() => window.__zcW302?.lateStarts ?? 0);
      await surface.focus();
      await surface.evaluate((element) => {
        element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      });
      await page.waitForFunction((switches) => (window.__zcW302?.switchCalls ?? 0) >= switches + 1, baselineSwitches);
      await page.waitForFunction(() => (window.__zcW302?.pendingStartCount ?? 0) >= 1);
      await surface.evaluate((element) => {
        element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      });
      await page.waitForFunction((switches) => (window.__zcW302?.switchCalls ?? 0) >= switches + 2, baselineSwitches);
      await resolveDeferredPreview(page, "rapid latest-wins");
      const stats = await page.evaluate(() => ({
        switches: window.__zcW302?.switchCalls ?? 0,
        lateStarts: window.__zcW302?.lateStarts ?? 0,
        identity: document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-identity"),
        hosts: document.querySelectorAll('[data-preview-shell="true"]').length
      }));
      assert(stats.switches >= baselineSwitches + 2, `rapid latest-wins did not reach both source switches: ${JSON.stringify(stats)}`);
      assert(stats.lateStarts >= baselineLateStarts + 1, `rapid latest-wins did not observe a stale completion: ${JSON.stringify(stats)}`);
      assert(stats.identity && stats.identity !== "none" && stats.hosts === 1, `rapid latest-wins lost the pinned final source: ${JSON.stringify(stats)}`);
      await unpin(page, "rapid Unpin");
    }, errors, evidence);

    assert(errors.length === 0, `Console/page errors at ${viewport.width}x${viewport.height}: ${JSON.stringify(errors)}`);
    await writeFile(path.join(ARTIFACT_DIR, `viewport-${viewport.width}x${viewport.height}.json`), JSON.stringify({
      sourceHead: SOURCE_HEAD,
      actualCheckoutSha: ACTUAL_CHECKOUT_SHA,
      actualCheckoutTree: ACTUAL_CHECKOUT_TREE,
      viewport,
      evidence
    }, null, 2));
    console.log(`[w3-03-real] PASS ${viewport.width}x${viewport.height} sourceHead=${SOURCE_HEAD} actualSha=${ACTUAL_CHECKOUT_SHA} tree=${ACTUAL_CHECKOUT_TREE}`);
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
