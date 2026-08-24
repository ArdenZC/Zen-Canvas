import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { assertCheckoutEvidence } from "./ciEvidence.mjs";

const SOURCE_HEAD = process.env.W308_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const EXPECTED_CHECKOUT_SHA = process.env.W308_EXPECTED_CHECKOUT_SHA ?? null;
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
if (EXPECTED_CHECKOUT_SHA) assertCheckoutEvidence(EXPECTED_CHECKOUT_SHA, ACTUAL_CHECKOUT_SHA);

const TASK_TEMP_DIR = path.resolve(".tmp-tests/w3-08-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w3-08-browser-gate");
const FIXTURE_QUERY = "w3-08-browser-fixture=archives&w3-02-browser-fixture=preview&w3-03-browser-fixture=pinned";

process.env.TEMP = TASK_TEMP_DIR;
process.env.TMP = TASK_TEMP_DIR;
process.env.TMPDIR = TASK_TEMP_DIR;
await mkdir(TASK_TEMP_DIR, { recursive: true });
await mkdir(ARTIFACT_DIR, { recursive: true });

let server;
let browser;

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
    workspace: [...document.querySelectorAll(".file-library-workspace")].some((element) => element.scrollWidth > element.clientWidth + 1),
    preview: [...document.querySelectorAll('[data-preview-shell="true"]')].some((element) => element.scrollWidth > element.clientWidth + 1)
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
  await list.locator('[role="option"]').first().waitFor({ state: "visible" });
  return list;
}

async function choose(page, surface, text, role = "option", domClick = false) {
  const item = surface.locator(`[role="${role}"]`).filter({ hasText: text }).first();
  await item.waitFor({ state: "visible" });
  const itemId = await item.getAttribute("id");
  if (domClick) await item.evaluate((element) => element instanceof HTMLElement && element.click());
  else await item.click();
  if (role === "option") {
    assert(itemId, `Could not identify selected ${text} row`);
    await page.waitForFunction((id) => {
      const row = id === null ? null : document.getElementById(id);
      return row?.getAttribute("aria-selected") === "true"
        && row.closest('[role="listbox"]')?.getAttribute("aria-activedescendant") === id;
    }, itemId);
  }
  return item;
}

async function chooseLibraryFile(page, name) {
  const list = await waitForLibrary(page);
  const search = page.locator('[data-file-library-local-search="true"]');
  await search.fill(name);
  await page.waitForFunction(() => document.querySelector('[data-library-source-owner="query-v2"]')?.getAttribute("data-library-provenance") === "query-v2-snapshot");
  await list.locator('[role="option"]').filter({ hasText: name }).first().waitFor({ state: "visible" });
  await choose(page, list, name);
  return list;
}

async function resolvePreview(page, label) {
  await page.waitForFunction(() => {
    const pending = window.__zcW302?.pendingStartCount ?? 0;
    return pending > 0;
  });
  const readyPhases = ["content", "metadata_fallback", "unsupported_representation"];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.evaluate(() => window.__zcW302?.resolveAll());
    await tick(page);
    const settled = await page.evaluate(() => ({
      pending: window.__zcW302?.pendingStartCount ?? 0,
      phase: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null
    }));
    if (settled.pending === 0 && readyPhases.includes(settled.phase ?? "")) return;
    if (settled.pending === 0) {
      try {
        await page.waitForFunction((phases) => {
          const pending = window.__zcW302?.pendingStartCount ?? 0;
          const phase = document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null;
          return pending > 0 || phases.includes(phase);
        }, readyPhases, { polling: "raf", timeout: 5_000 });
      } catch {
        break;
      }
    }
  }
  const stats = await page.evaluate(() => window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null);
  throw new Error(`${label}: deferred Preview did not settle ${JSON.stringify(stats)}`);
}

async function openFloating(page, surface, label, resolve = true) {
  await surface.focus();
  if (await surface.getAttribute("aria-activedescendant") === null) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForSelector('[data-preview-host="zen-floating"]');
  const identity = await page.locator('[data-preview-host="zen-floating"]').getAttribute("data-preview-identity");
  assert(identity && identity !== "none", `${label}: Floating Preview has no source identity`);
  if (resolve) await resolvePreview(page, label);
  assert(await page.locator('[data-preview-host="zen-floating"]').count() === 1, `${label}: duplicate Floating hosts`);
}

async function closeFloating(page, label) {
  await page.locator('[data-preview-host="zen-floating"] [aria-label="Close preview"]').click();
  await page.waitForSelector('[data-preview-shell="true"]', { state: "detached" });
  assert(await page.locator('[data-preview-shell="true"]').count() === 0, `${label}: Floating Preview remained mounted`);
}

async function assertArchive(page, label, state = "complete") {
  const representation = page.locator('[data-preview-representation="archive_tree"]');
  try {
    await representation.waitFor({ state: "visible" });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      phase: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null,
      identity: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-identity") ?? null,
      representations: [...document.querySelectorAll("[data-preview-representation]")].map((element) => element.getAttribute("data-preview-representation")),
      bodyText: document.querySelector('[data-preview-host="zen-floating"], [data-preview-host="zen-pinned"]')?.textContent ?? null,
      options: [...document.querySelectorAll('[data-shared-file-list="true"] [role="option"]')].map((element) => ({ text: element.textContent, id: element.id, selected: element.getAttribute("aria-selected") })),
      lists: [...document.querySelectorAll('[data-shared-file-list="true"]')].map((element) => ({
        source: element.getAttribute("data-shared-file-list-source"),
        active: element.getAttribute("aria-activedescendant"),
        focused: element === document.activeElement
      })),
      w302: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null
    }));
    throw new Error(`${label}: archive representation missing ${JSON.stringify(diagnostics)} (${String(error)})`);
  }
  const archiveSnapshot = await page.evaluate(() => {
    const element = document.querySelector('[data-preview-representation="archive_tree"]');
    if (!element) return null;
    return {
      state: element.getAttribute("data-preview-archive-state"),
      inspected: element.getAttribute("data-preview-archive-inspected"),
      observed: element.getAttribute("data-preview-archive-observed"),
      selectable: element.getAttribute("data-preview-selectable"),
      interactiveCount: element.querySelectorAll("a,button,input,select,textarea,img,video,audio,iframe").length,
      nodeCount: element.querySelectorAll("[data-preview-archive-kind]").length,
      forbidden: [...element.querySelectorAll("[href],[src]")].map((node) => ({
        href: node.getAttribute("href"),
        src: node.getAttribute("src")
      }))
    };
  });
  assert(archiveSnapshot !== null, `${label}: archive tree detached during contract assertion`);
  assert(archiveSnapshot.state === state, `${label}: archive state mismatch`);
  assert(archiveSnapshot.inspected !== null, `${label}: inspected count missing`);
  assert(archiveSnapshot.observed !== null, `${label}: observed count missing`);
  assert(archiveSnapshot.selectable === "false", `${label}: archive tree became selectable`);
  assert(await page.locator('[data-preview-navigation="previous"], [data-preview-navigation="next"]').count() === 2, `${label}: sibling navigation left the host-owned Preview shell`);
  assert(archiveSnapshot.interactiveCount === 0, `${label}: archive tree mounted an interactive/resource element`);
  assert(archiveSnapshot.nodeCount <= 2_000, `${label}: rendered node cap exceeded`);
  assert(archiveSnapshot.forbidden.length === 0, `${label}: archive tree exposed a resource attribute ${JSON.stringify(archiveSnapshot.forbidden)}`);
}

async function assertFallback(page, label) {
  await page.locator('[data-preview-metadata="true"]').waitFor({ state: "visible" });
  assert(await page.locator('[data-preview-representation="archive_tree"]').count() === 0, `${label}: corrupt archive published ArchiveTree`);
}

async function pin(page, viewport, label) {
  await page.locator('[data-preview-pin="true"]').click();
  await page.waitForFunction(() => document.querySelector('[data-preview-host="zen-pinned"]') !== null
    && document.querySelectorAll('[data-preview-shell="true"]').length === 1
    && document.querySelector('[data-preview-host="zen-floating"]') === null);
  assert(await page.locator('[data-file-library-context-content="preview"]').count() === 1, `${label}: pinned host left Context ownership`);
  if (viewport.width <= 980) {
    assert(await page.locator('[data-side-sheet="true"]').count() === 1, `${label}: compact Context did not own one SideSheet`);
    assert(await page.locator('[data-modal-layer="true"]').count() === 1, `${label}: compact Pinned Preview created a second focus trap`);
  } else {
    assert(await page.locator('.file-library-workspace[data-layout="large"] [data-preview-host="zen-pinned"]').count() === 1, `${label}: Pinned Preview was not inline Context content`);
    assert(await page.locator('[data-modal-layer="true"]').count() === 0, `${label}: large Pinned Preview opened a modal layer`);
  }
  if ((await page.evaluate(() => window.__zcW302?.pendingStartCount ?? 0)) > 0) await resolvePreview(page, `${label} staged`);
}

async function unpin(page, label) {
  await page.locator('[data-preview-unpin="true"]').click();
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') === null);
  assert(await page.locator('[data-file-library-context-content="preview"]').count() === 0, `${label}: Preview remained mounted after Unpin`);
}

async function openBrowse(page) {
  if (await page.getByRole("tab", { name: "Browse", exact: true }).count() === 0) await waitForLibrary(page);
  await page.getByRole("tab", { name: "Browse", exact: true }).click();
  await page.waitForSelector('.file-library-workspace[data-mode="browse"]');
  if (await page.locator('[data-browse-state="current-folder"]').count() === 0) {
    const openable = page.locator('[data-browse-location-openable="true"] [data-browse-location-action="open"]');
    await openable.first().waitFor({ state: "visible" });
    await openable.first().click();
  }
  await page.locator('[data-browse-state="current-folder"]').waitFor({ state: "visible" });
  const list = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
  await list.locator('[role="option"]').first().waitFor({ state: "visible" });
  return list;
}

async function runScenario(context, baseUrl, appOrigin, viewport, label, scenario, evidence) {
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const errors = [];
  const networkViolations = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push({ kind: "console", text: message.text() }); });
  page.on("pageerror", (error) => errors.push({ kind: "pageerror", text: String(error) }));
  page.on("request", (request) => {
    const url = request.url();
    const isAppResource = url.startsWith(`${appOrigin}/`) || url === appOrigin || url.startsWith("ws:") || url.startsWith("wss:");
    if (!isAppResource || /^(file:|data:|blob:)/u.test(url)) networkViolations.push({ kind: "request", url });
  });
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (!url.startsWith(`${appOrigin}/`) && url !== appOrigin) networkViolations.push({ kind: "navigation", url });
  });
  try {
    await page.goto(`${baseUrl}?${FIXTURE_QUERY}`, { waitUntil: "commit" });
    await assertPageIdentity(page, label);
    await scenario(page);
    assert(networkViolations.length === 0, `${label}: unexpected external/resource request ${JSON.stringify(networkViolations)}`);
    assert(errors.length === 0, `${label}: console/page errors ${JSON.stringify(errors)}`);
    await assertNoHorizontalOverflow(page, `${label} ${viewport.width}x${viewport.height}`);
    evidence.push({ label, viewport, networkViolations, errors, w302: await page.evaluate(() => window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null) });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${label}-${viewport.width}x${viewport.height}.png`), fullPage: true });
  } finally {
    await page.close();
  }
}

async function exerciseViewport(baseUrl, appOrigin, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem("zc-onboarding-complete", "true");
    window.localStorage.setItem("zc-language", "en");
  });
  const evidence = [];
  try {
    await runScenario(context, baseUrl, appOrigin, viewport, "library-archive-floating-pinned", async (page) => {
      const list = await chooseLibraryFile(page, "archive-sample.zip");
      await openFloating(page, list, "Library archive Floating");
      await assertArchive(page, "Library archive Floating");
      await pin(page, viewport, "Library archive Pin");
      await assertArchive(page, "Library archive Pinned");
      await unpin(page, "Library archive Unpin");
      await page.reload({ waitUntil: "commit" });
      await assertPageIdentity(page, "Empty archive reload");
      const emptyList = await chooseLibraryFile(page, "archive-empty.zip");
      await openFloating(page, emptyList, "Empty archive Floating");
      await assertArchive(page, "Empty archive Floating");
      assert(await page.locator('[data-preview-representation="archive_tree"]').getAttribute("data-preview-archive-inspected") === "0", "Empty archive inspected count was not zero");
      assert(await page.locator('[data-preview-representation="archive_tree"]').getAttribute("data-preview-archive-observed") === "0", "Empty archive observed count was not zero");
      await closeFloating(page, "Empty archive Close");
    }, evidence);

    await runScenario(context, baseUrl, appOrigin, viewport, "archive-partial-hostile-fallback", async (page) => {
      let list = await chooseLibraryFile(page, "archive-partial.zip");
      await openFloating(page, list, "Partial archive");
      await assertArchive(page, "Partial archive", "partial");
      await closeFloating(page, "Partial archive close");
      await page.reload({ waitUntil: "commit" });
      await assertPageIdentity(page, "Hostile archive reload");
      list = await chooseLibraryFile(page, "archive-hostile.zip");
      await openFloating(page, list, "Hostile archive");
      await assertArchive(page, "Hostile archive");
      assert(await page.locator('[data-preview-archive-unsafe="true"]').count() >= 2, "Hostile archive names were not visibly marked");
      await closeFloating(page, "Hostile archive close");
      await page.reload({ waitUntil: "commit" });
      await assertPageIdentity(page, "Corrupt archive reload");
      list = await chooseLibraryFile(page, "archive-corrupt.zip");
      await openFloating(page, list, "Corrupt archive");
      await assertFallback(page, "Corrupt archive");
      await closeFloating(page, "Corrupt archive close");
    }, evidence);

    await runScenario(context, baseUrl, appOrigin, viewport, "browse-archive-source-follow-latest-wins", async (page) => {
      const browse = await openBrowse(page);
      await choose(page, browse, "archive-sample.zip");
      await openFloating(page, browse, "Browse archive Floating");
      await assertArchive(page, "Browse archive Floating");
      await pin(page, viewport, "Browse archive Pin");
      await assertArchive(page, "Browse archive Pinned");
      await unpin(page, "Browse archive Unpin");
      await page.reload({ waitUntil: "commit" });
      await assertPageIdentity(page, "Latest-wins archive reload");
      const list = await chooseLibraryFile(page, "archive-sample.zip");
      await openFloating(page, list, "Latest-wins archive A", false);
      await page.waitForFunction(() => (window.__zcW302?.pendingStartCount ?? 0) > 0);
      await choose(page, list, "archive-hostile.zip", "option", true);
      await resolvePreview(page, "Latest-wins archive B");
      await assertArchive(page, "Latest-wins archive B");
      assert((await page.locator('[data-preview-host="zen-floating"]').textContent())?.includes("../escaped.txt") === true, "Latest-wins archive committed stale A");
      await closeFloating(page, "Latest-wins archive close");
    }, evidence);

    await runScenario(context, baseUrl, appOrigin, viewport, "archive-no-source", async (page) => {
      const list = await chooseLibraryFile(page, "archive-sample.zip");
      await openFloating(page, list, "No-source archive");
      await assertArchive(page, "No-source archive");
      await pin(page, viewport, "No-source archive Pin");
      await page.locator('[data-file-library-mode="browse"]').evaluate((element) => element instanceof HTMLElement && element.click());
      await page.waitForFunction(() => document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-state") === "no_source");
      await unpin(page, "No-source archive Unpin");
    }, evidence);
  } finally {
    await context.close();
  }
  await writeFile(path.join(ARTIFACT_DIR, `viewport-${viewport.width}x${viewport.height}.json`), JSON.stringify({
    sourceHead: SOURCE_HEAD,
    actualCheckoutSha: ACTUAL_CHECKOUT_SHA,
    actualCheckoutTree: ACTUAL_CHECKOUT_TREE,
    viewport,
    evidence
  }, null, 2));
  console.log(`[w3-08-real] PASS ${viewport.width}x${viewport.height} sourceHead=${SOURCE_HEAD} actualSha=${ACTUAL_CHECKOUT_SHA} tree=${ACTUAL_CHECKOUT_TREE}`);
}

try {
  server = await createServer({
    configFile: path.resolve("vite.config.ts"),
    server: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  await server.listen();
  const baseUrl = server.resolvedUrls?.local?.[0]?.replace(/\/$/u, "");
  if (!baseUrl) throw new Error("Vite did not expose a local browser URL.");
  const appOrigin = new URL(baseUrl).origin;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.W308_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W308_CHROMIUM_EXECUTABLE } : {})
  });
  await exerciseViewport(baseUrl, appOrigin, { width: 1600, height: 900 });
  await exerciseViewport(baseUrl, appOrigin, { width: 980, height: 680 });
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  await rm(ARTIFACT_DIR, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  await rm(TASK_TEMP_DIR, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
