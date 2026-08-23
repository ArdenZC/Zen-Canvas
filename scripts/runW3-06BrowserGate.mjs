import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { assertCheckoutEvidence } from "./ciEvidence.mjs";

const SOURCE_HEAD = process.env.W306_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const EXPECTED_CHECKOUT_SHA = process.env.W306_EXPECTED_CHECKOUT_SHA ?? null;
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
if (EXPECTED_CHECKOUT_SHA) assertCheckoutEvidence(EXPECTED_CHECKOUT_SHA, ACTUAL_CHECKOUT_SHA);

const TASK_TEMP_DIR = path.resolve(".tmp-tests/w3-06-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w3-06-browser-gate");
const FIXTURE_QUERY = "w3-06-browser-fixture=images&w3-02-browser-fixture=preview&w3-03-browser-fixture=pinned";

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
const appOrigin = new URL(baseUrl).origin;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.W306_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W306_CHROMIUM_EXECUTABLE } : {})
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
    const shell = document.querySelector('[data-preview-shell="true"]');
    const pending = window.__zcW302?.pendingStartCount ?? 0;
    const state = shell?.getAttribute("data-preview-state");
    return pending > 0 && (state === "resolving" || state === "loading");
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.evaluate(() => window.__zcW302?.resolveAll());
    await tick(page);
    const settled = await page.evaluate(() => ({
      pending: window.__zcW302?.pendingStartCount ?? 0,
      phase: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null
    }));
    if (settled.pending === 0 && ["content", "metadata_fallback", "unsupported_representation"].includes(settled.phase ?? "")) return;
  }
  const stats = await page.evaluate(() => ({
    w302: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null,
    w306: window.__zcW306 ? JSON.parse(JSON.stringify(window.__zcW306)) : null
  }));
  throw new Error(`${label}: deferred Preview did not settle ${JSON.stringify(stats)}`);
}

async function resolveImageAsset(page, label) {
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-preview-representation="image"]');
    return image === null || (window.__zcW306?.pendingAssetCount ?? 0) > 0 || image.getAttribute("data-preview-image-status") !== "loading";
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.evaluate(() => window.__zcW306?.resolveAllAssets());
    await tick(page);
    const status = await page.locator('[data-preview-representation="image"]').getAttribute("data-preview-image-status").catch(() => null);
    if (status === null || status === "ready" || status === "failed") return;
  }
  const stats = await page.evaluate(() => window.__zcW306 ? JSON.parse(JSON.stringify(window.__zcW306)) : null);
  throw new Error(`${label}: image asset did not settle ${JSON.stringify(stats)}`);
}

async function openFloating(page, surface, label, resolveAsset = true) {
  await surface.focus();
  if (await surface.getAttribute("aria-activedescendant") === null) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForSelector('[data-preview-host="zen-floating"]');
  const identity = await page.locator('[data-preview-host="zen-floating"]').getAttribute("data-preview-identity");
  assert(identity && identity !== "none", `${label}: Floating Preview has no source identity`);
  await resolvePreview(page, label);
  if (resolveAsset && await page.locator('[data-preview-representation="image"]').count() > 0) await resolveImageAsset(page, label);
  assert(await page.locator('[data-preview-host="zen-floating"]').count() === 1, `${label}: duplicate Floating hosts`);
  return identity;
}

async function closeFloating(page, label) {
  await page.locator('[data-preview-host="zen-floating"] [aria-label="Close preview"]').click();
  await page.waitForSelector('[data-preview-shell="true"]', { state: "detached" });
  assert(await page.locator('[data-preview-shell="true"]').count() === 0, `${label}: Floating Preview remained mounted`);
}

async function assertImage(page, label, completeness = "complete") {
  const representation = page.locator('[data-preview-representation="image"]');
  try {
    await representation.waitFor({ state: "visible", timeout: 5_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      phase: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null,
      identity: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-identity") ?? null,
      representations: [...document.querySelectorAll("[data-preview-representation]")].map((element) => element.getAttribute("data-preview-representation")),
      w306: window.__zcW306 ? JSON.parse(JSON.stringify(window.__zcW306)) : null
    }));
    throw new Error(`${label}: image representation missing ${JSON.stringify(diagnostics)} (${String(error)})`);
  }
  try {
    await page.waitForFunction((expected) => document.querySelector('[data-preview-representation="image"]')?.getAttribute("data-preview-image-status") === expected, "ready", { timeout: 5_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      status: document.querySelector('[data-preview-representation="image"]')?.getAttribute("data-preview-image-status") ?? null,
      imageSource: document.querySelector('[data-preview-representation="image"] img')?.getAttribute("src") ?? null,
      shellState: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null,
      hostText: document.querySelector('[data-preview-host="zen-floating"]')?.textContent ?? null,
      w306: window.__zcW306 ? JSON.parse(JSON.stringify(window.__zcW306)) : null,
      browserUrls: window.__zcW306Browser ? JSON.parse(JSON.stringify(window.__zcW306Browser)) : null
    }));
    throw new Error(`${label}: image did not become ready ${JSON.stringify(diagnostics)} (${String(error)})`);
  }
  assert(await representation.getAttribute("data-preview-completeness") === completeness, `${label}: completeness mismatch`);
  assert(await representation.locator("img").count() === 1, `${label}: image element missing`);
  assert((await representation.locator("img").getAttribute("src"))?.startsWith("blob:"), `${label}: image did not use a controlled blob URL`);
  assert(await representation.locator("img").getAttribute("alt")?.then((value) => !value.includes("/") && !value.includes("\\")), `${label}: unsafe image alt text`);
  assert(await representation.locator(".zc-preview-image-value").count() === 1, `${label}: fit-to-view class missing`);
}

async function pin(page, viewport, label, resolveAsset = true) {
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
  if (await page.evaluate(() => window.__zcW302?.pendingStartCount ?? 0) > 0) await resolvePreview(page, `${label} staged Pinned Preview`);
  if (resolveAsset && await page.locator('[data-preview-representation="image"]').count() > 0) await resolveImageAsset(page, `${label} image`);
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

async function runScenario(context, viewport, label, scenario, evidence) {
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const errors = [];
  const networkViolations = [];
  const blobRequests = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push({ kind: "console", text: message.text() }); });
  page.on("pageerror", (error) => errors.push({ kind: "pageerror", text: String(error) }));
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("blob:")) {
      blobRequests.push(url);
      return;
    }
    const isAppResource = url.startsWith(`${appOrigin}/`) || url === appOrigin || url.startsWith("ws:") || url.startsWith("wss:");
    if (!isAppResource || /^(file:|data:)/u.test(url)) networkViolations.push({ kind: "request", url });
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
    const lifecycle = await page.evaluate(() => window.__zcW306Browser ? JSON.parse(JSON.stringify(window.__zcW306Browser)) : null);
    assert(lifecycle !== null, `${label}: browser object-URL instrumentation missing`);
    assert(lifecycle.live.length === 0, `${label}: live object URLs remained ${JSON.stringify(lifecycle)}`);
    assert(blobRequests.every((url) => url.startsWith("blob:")), `${label}: non-blob image request was misclassified ${JSON.stringify(blobRequests)}`);
    assert(networkViolations.length === 0, `${label}: unexpected external/resource navigation ${JSON.stringify(networkViolations)}`);
    assert(errors.length === 0, `${label}: console/page errors ${JSON.stringify(errors)}`);
    await assertNoHorizontalOverflow(page, `${label} ${viewport.width}x${viewport.height}`);
    evidence.push({
      label,
      viewport,
      networkViolations,
      blobRequests,
      lifecycle,
      w306: await page.evaluate(() => window.__zcW306 ? JSON.parse(JSON.stringify(window.__zcW306)) : null)
    });
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
    const created = [];
    const revoked = [];
    const live = new Set();
    const nativeCreate = URL.createObjectURL.bind(URL);
    const nativeRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = nativeCreate(blob);
      created.push(url);
      live.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
      live.delete(url);
      nativeRevoke(url);
    };
    window.__zcW306Browser = { created, revoked, get live() { return [...live]; } };
  });
  const evidence = [];
  try {
    await runScenario(context, viewport, "library-png-floating-pinned", async (page) => {
      const list = await chooseLibraryFile(page, "image-sample.png");
      await openFloating(page, list, "Library PNG Floating");
      await assertImage(page, "Library PNG Floating");
      await pin(page, viewport, "Library PNG Pin");
      await assertImage(page, "Library PNG Pinned", "complete");
      await unpin(page, "Library PNG Unpin");
    }, evidence);

    await runScenario(context, viewport, "library-jpeg-floating", async (page) => {
      const list = await chooseLibraryFile(page, "image-sample.jpg");
      await openFloating(page, list, "Library JPEG Floating");
      await assertImage(page, "Library JPEG Floating");
      await closeFloating(page, "Library JPEG Close");
    }, evidence);

    await runScenario(context, viewport, "library-partial-and-fallback", async (page) => {
      let list = await chooseLibraryFile(page, "image-bounded.png");
      await openFloating(page, list, "Partial Image Floating");
      await assertImage(page, "Partial Image", "partial");
      assert(await page.locator('[data-preview-partial="true"]').count() === 1, "Partial Image disclosure missing");
      await closeFloating(page, "Partial Image Close");
      for (const name of ["image-corrupt.png", "image-oversized.png", "image-vector.svg"]) {
        await page.reload({ waitUntil: "commit" });
        await assertPageIdentity(page, `${name} reload`);
        list = await chooseLibraryFile(page, name);
        await openFloating(page, list, `${name} fallback`);
        await page.locator('[data-preview-metadata="true"]').waitFor({ state: "visible" });
        assert(await page.locator('[data-preview-representation="image"]').count() === 0, `${name}: fallback mounted Image content`);
        await closeFloating(page, `${name} close`);
      }
    }, evidence);

    await runScenario(context, viewport, "browse-png-jpeg-floating-pinned", async (page) => {
      let browse = await openBrowse(page);
      await choose(page, browse, "image-sample.png");
      await openFloating(page, browse, "Browse PNG Floating");
      await assertImage(page, "Browse PNG Floating");
      await pin(page, viewport, "Browse PNG Pin");
      await assertImage(page, "Browse PNG Pinned");
      await unpin(page, "Browse PNG Unpin");
      await page.reload({ waitUntil: "commit" });
      await assertPageIdentity(page, "Browse JPEG reload");
      browse = await openBrowse(page);
      await choose(page, browse, "image-sample.jpg");
      await openFloating(page, browse, "Browse JPEG Floating");
      await assertImage(page, "Browse JPEG Floating");
      await closeFloating(page, "Browse JPEG Close");
    }, evidence);

    await runScenario(context, viewport, "image-latest-wins-and-no-source", async (page) => {
      const list = await chooseLibraryFile(page, "image-sample.png");
      const search = page.locator('[data-file-library-local-search="true"]');
      await search.fill("");
      await page.waitForFunction(() => document.querySelector('[data-library-source-owner="query-v2"]')?.getAttribute("data-library-provenance") === "query-v2-snapshot");
      await openFloating(page, list, "Image latest-wins A", false);
      await page.waitForFunction(() => document.querySelector('[data-preview-image-status="loading"]') !== null
        && (window.__zcW306?.pendingAssetCount ?? 0) > 0);
      await pin(page, viewport, "Image latest-wins Pin", false);
      await choose(page, list, "image-sample.jpg", "option", true);
      await resolvePreview(page, "Image latest-wins B");
      await resolveImageAsset(page, "Image latest-wins B asset");
      await assertImage(page, "Image latest-wins B");
      const status = await page.locator('[data-preview-representation="image"]').getAttribute("data-preview-image-status");
      assert(status === "ready", `Image latest-wins committed stale status ${status}`);
      await unpin(page, "Image latest-wins Unpin");

      await page.reload({ waitUntil: "commit" });
      await assertPageIdentity(page, "Image no-source reload");
      const pinnedList = await chooseLibraryFile(page, "image-sample.png");
      await openFloating(page, pinnedList, "Image no-source A");
      await pin(page, viewport, "Image no-source Pin");
      await page.locator('[data-file-library-mode="browse"]').evaluate((element) => element instanceof HTMLElement && element.click());
      await page.waitForFunction(() => document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-state") === "no_source"
        && document.querySelector('[data-preview-no-source="true"]') !== null);
      await unpin(page, "Image no-source Unpin");
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
  console.log(`[w3-06-real] PASS ${viewport.width}x${viewport.height} sourceHead=${SOURCE_HEAD} actualSha=${ACTUAL_CHECKOUT_SHA} tree=${ACTUAL_CHECKOUT_TREE}`);
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
