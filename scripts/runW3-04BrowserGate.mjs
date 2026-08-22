import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { assertCheckoutEvidence } from "./ciEvidence.mjs";

const SOURCE_HEAD = process.env.W304_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const EXPECTED_CHECKOUT_SHA = process.env.W304_EXPECTED_CHECKOUT_SHA ?? null;
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
if (EXPECTED_CHECKOUT_SHA) assertCheckoutEvidence(EXPECTED_CHECKOUT_SHA, ACTUAL_CHECKOUT_SHA);

const TASK_TEMP_DIR = path.resolve(".tmp-tests/w3-04-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w3-04-browser-gate");
const FIXTURE_QUERY = "w3-04-browser-fixture=providers&w3-02-browser-fixture=preview&w3-03-browser-fixture=pinned&w2-09-browser-fixture=platform";

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
  ...(process.env.W304_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W304_CHROMIUM_EXECUTABLE } : {})
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
  await list.locator('[role="option"]').first().waitFor({ state: "visible" });
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

async function choose(surface, text, role = "option") {
  const item = surface.locator(`[role="${role}"]`).filter({ hasText: text }).first();
  await item.waitFor({ state: "visible" });
  await item.click();
  return item;
}

async function resolveDeferred(page, label) {
  await page.waitForFunction(() => {
    const shell = document.querySelector('[data-preview-shell="true"]');
    const pending = window.__zcW302?.pendingStartCount ?? 0;
    const state = shell?.getAttribute("data-preview-state");
    return pending > 0 && (state === "resolving" || state === "loading");
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.evaluate(() => window.__zcW302?.resolveAll());
    await tick(page);
    const state = await page.evaluate(() => ({
      pending: window.__zcW302?.pendingStartCount ?? 0,
      phase: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null
    }));
    if (state.pending === 0 && ["content", "metadata_fallback", "unsupported_representation"].includes(state.phase ?? "")) return;
  }
  const stats = await page.evaluate(() => ({
    w302: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null,
    w304: window.__zcW304 ? JSON.parse(JSON.stringify(window.__zcW304)) : null
  }));
  throw new Error(`${label}: deferred Preview did not settle ${JSON.stringify(stats)}`);
}

async function openFloating(page, surface, label) {
  await surface.focus();
  if (await surface.getAttribute("aria-activedescendant") === null) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForSelector('[data-preview-host="zen-floating"]');
  const identity = await page.locator('[data-preview-host="zen-floating"]').getAttribute("data-preview-identity");
  assert(identity && identity !== "none", `${label}: Floating Preview has no source identity`);
  await resolveDeferred(page, label);
  assert(await page.locator('[data-preview-host="zen-floating"]').count() === 1, `${label}: duplicate Floating hosts`);
  return identity;
}

async function assertRepresentation(page, family, label, host = "zen-floating") {
  const representation = page.locator(`[data-preview-host="${host}"] [data-preview-representation="${family}"]`);
  await representation.waitFor({ state: "visible" });
  assert(await representation.getAttribute("data-preview-completeness") !== "unknown", `${label}: representation completeness was unknown`);
  return representation;
}

async function assertSafeHtml(page, label, host = "zen-floating") {
  const root = page.locator(`[data-preview-host="${host}"] .zc-preview-safe-html-root`);
  await root.waitFor({ state: "visible" });
  const violations = await root.evaluate((element) => ({
    activeTags: [...element.querySelectorAll("script,iframe,object,embed,style,link,img,video,audio,source,a,form,base,meta")].map((node) => node.tagName),
    resourceAttributes: [...element.querySelectorAll("*")].flatMap((node) => ["src", "href", "srcset", "action", "formaction", "style", "srcdoc", "ping", "poster", "cite", "background", "manifest"].filter((name) => node.hasAttribute(name))),
    eventAttributes: [...element.querySelectorAll("*")].flatMap((node) => [...node.attributes].filter((attribute) => attribute.name.toLowerCase().startsWith("on")).map((attribute) => attribute.name))
  }));
  assert(violations.activeTags.length === 0, `${label}: active/resource tags mounted ${JSON.stringify(violations)}`);
  assert(violations.resourceAttributes.length === 0, `${label}: resource attributes mounted ${JSON.stringify(violations)}`);
  assert(violations.eventAttributes.length === 0, `${label}: event attributes mounted ${JSON.stringify(violations)}`);
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
  const pending = await page.evaluate(() => window.__zcW302?.pendingStartCount ?? 0);
  if (pending > 0) await resolveDeferred(page, `${label} staged Pinned Preview`);
}

async function movePinned(page, direction, label) {
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
  await resolveDeferred(page, label);
  const after = await shell.getAttribute("data-preview-identity");
  assert(after && after !== before, `${label}: ${direction} did not change source`);
  return { before, after };
}

async function unpin(page, label) {
  await page.locator('[data-preview-unpin="true"]').click();
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') === null);
  assert(await page.locator('[data-file-library-context-content="preview"]').count() === 0, `${label}: Preview remained mounted after Unpin`);
  const context = page.locator("[data-file-library-context-content]");
  if (await context.count() > 0) {
    const content = await context.getAttribute("data-file-library-context-content");
    assert(content === "inspector" || content === "selection", `${label}: Context did not return to Inspector/selection: ${content}`);
  }
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
  return page.locator('[data-shared-file-list="true"][data-shared-file-list-source="browse"]');
}

async function runScenario(context, viewport, label, scenario, evidence) {
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const errors = [];
  const networkViolations = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ kind: "console", text: message.text() });
  });
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
    assert(networkViolations.length === 0, `${label}: unexpected external/resource navigation ${JSON.stringify(networkViolations)}`);
    assert(errors.length === 0, `${label}: console/page errors ${JSON.stringify(errors)}`);
    await assertNoHorizontalOverflow(page, `${label} ${viewport.width}x${viewport.height}`);
    evidence.push({
      label,
      viewport,
      w304: await page.evaluate(() => (window.__zcW304 ? JSON.parse(JSON.stringify(window.__zcW304)) : null)),
      w302: await page.evaluate(() => (window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null)),
      networkViolations
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
  });
  const evidence = [];
  try {
    await runScenario(context, viewport, "library-code-floating-pinned", async (page) => {
      const list = await waitForLibrary(page);
      await choose(list, "preview-fixture.rs");
      await openFloating(page, list, "Library code Floating");
      const text = await assertRepresentation(page, "text", "Library code text");
      assert((await text.textContent())?.includes("rust") === true, "Library code language hint was not rendered");
      await pin(page, viewport, "Library code Pin");
      await assertRepresentation(page, "text", "Pinned code text", "zen-pinned");
      assert((await page.locator('[data-preview-host="zen-pinned"]').textContent())?.includes("rust") === true, "Pinned code language hint was lost");
      await unpin(page, "Library code Unpin");
    }, evidence);

    await runScenario(context, viewport, "library-markdown-hostile", async (page) => {
      const list = await waitForLibrary(page);
      await choose(list, "W3-04-hostile.md");
      await openFloating(page, list, "Library Markdown Floating");
      await assertRepresentation(page, "safe_html", "Library Markdown SafeHTML");
      await assertSafeHtml(page, "Library Markdown hostile fixture");
      await pin(page, viewport, "Library Markdown Pin");
      await assertRepresentation(page, "safe_html", "Pinned Markdown SafeHTML", "zen-pinned");
      await assertSafeHtml(page, "Pinned Markdown hostile fixture", "zen-pinned");
      await unpin(page, "Library Markdown Unpin");
    }, evidence);

    await runScenario(context, viewport, "library-partial-and-fallback", async (page) => {
      const list = await waitForLibrary(page);
      await choose(list, "bounded-prefix.txt");
      await openFloating(page, list, "Partial text Floating");
      const partial = await assertRepresentation(page, "text", "Partial text");
      assert(await partial.getAttribute("data-preview-completeness") === "partial", "Partial text did not preserve Partial completeness");
      assert(await partial.locator('[data-preview-partial="true"]').count() === 1, "Partial text disclosure was not visible");
      await page.locator('[data-preview-host="zen-floating"] [aria-label="Close preview"]').click();
      await page.waitForSelector('[data-preview-shell="true"]', { state: "detached" });
      await choose(list, "unsupported-preview.bin");
      await openFloating(page, list, "Metadata fallback Floating");
      await page.locator('[data-preview-metadata="true"]').waitFor({ state: "visible" });
      await page.locator('[data-preview-host="zen-floating"] [aria-label="Close preview"]').click();
      await page.waitForSelector('[data-preview-shell="true"]', { state: "detached" });
    }, evidence);

    await runScenario(context, viewport, "library-bounded-navigation-and-latest-wins", async (page) => {
      const list = await waitForLibrary(page);
      await choose(list, "bounded-prefix.txt");
      await openFloating(page, list, "Library navigation Floating");
      await pin(page, viewport, "Library navigation Pin");
      const first = await page.locator('[data-preview-host="zen-pinned"]').getAttribute("data-preview-identity");
      await movePinned(page, "next", "Library navigation Next");
      await movePinned(page, "previous", "Library navigation Previous");
      const baselineSwitches = await page.evaluate(() => window.__zcW302?.switchCalls ?? 0);
      const baselineLate = await page.evaluate(() => window.__zcW302?.lateStarts ?? 0);
      await list.focus();
      await list.evaluate((element) => element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })));
      await page.waitForFunction((count) => (window.__zcW302?.switchCalls ?? 0) >= count + 1, baselineSwitches);
      await list.evaluate((element) => element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })));
      await page.waitForFunction((count) => (window.__zcW302?.switchCalls ?? 0) >= count + 2, baselineSwitches);
      await resolveDeferred(page, "Library latest-wins rich switch");
      const final = await page.locator('[data-preview-host="zen-pinned"]').getAttribute("data-preview-identity");
      const stats = await page.evaluate(() => ({ late: window.__zcW302?.lateStarts ?? 0, hosts: document.querySelectorAll('[data-preview-shell="true"]').length }));
      assert(first !== final && final !== "none", `Latest-wins lost the final source: ${JSON.stringify({ first, final, stats })}`);
      assert(stats.late >= baselineLate + 1, `Latest-wins did not observe a stale completion: ${JSON.stringify(stats)}`);
      assert(stats.hosts === 1, `Latest-wins mounted duplicate hosts: ${JSON.stringify(stats)}`);
      await unpin(page, "Library navigation Unpin");
    }, evidence);

    await runScenario(context, viewport, "browse-code-and-markdown", async (page) => {
      const browse = await openBrowse(page);
      await choose(browse, "preview-fixture.rs");
      await openFloating(page, browse, "Browse code Floating");
      await assertRepresentation(page, "text", "Browse code text");
      await pin(page, viewport, "Browse code Pin");
      await assertRepresentation(page, "text", "Browse code Pinned", "zen-pinned");
      await unpin(page, "Browse code Unpin");
    }, evidence);

    await runScenario(context, viewport, "browse-markdown-hostile", async (page) => {
      const browse = await openBrowse(page);
      await choose(browse, "W3-04-hostile.md");
      await openFloating(page, browse, "Browse Markdown Floating");
      await assertSafeHtml(page, "Browse Markdown hostile fixture");
      await page.locator('[data-preview-host="zen-floating"] [aria-label="Close preview"]').click();
      await page.waitForSelector('[data-preview-shell="true"]', { state: "detached" });
    }, evidence);

    await runScenario(context, viewport, "grid-follow", async (page) => {
      await waitForLibrary(page);
      const grid = await switchView(page, "grid", "library");
      await choose(grid, "bounded-prefix.txt", "gridcell");
      await openFloating(page, grid, "Library grid Floating");
      await pin(page, viewport, "Library grid Pin");
      const before = await page.locator('[data-preview-host="zen-pinned"]').getAttribute("data-preview-identity");
      await grid.evaluate((element) => element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })));
      await page.waitForFunction((previous) => {
        const current = document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-identity");
        return current !== null && current !== previous && (window.__zcW302?.pendingStartCount ?? 0) > 0;
      }, before);
      await resolveDeferred(page, "Library grid source follow");
      await unpin(page, "Library grid Unpin");
    }, evidence);

    await runScenario(context, viewport, "pinned-no-source", async (page) => {
      const list = await waitForLibrary(page);
      await choose(list, "W3-04-hostile.md");
      await openFloating(page, list, "No-source Floating");
      await pin(page, viewport, "No-source Pin");
      await page.locator('[data-file-library-mode="browse"]').evaluate((element) => element instanceof HTMLElement && element.click());
      await page.waitForFunction(() => document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-identity") === "none"
        && document.querySelector('[data-preview-host="zen-pinned"]')?.getAttribute("data-preview-state") === "no_source"
        && document.querySelector('[data-preview-no-source="true"]') !== null);
      await unpin(page, "No-source Unpin");
    }, evidence);
  } finally {
    await context.close();
  }
  console.log(`[w3-04-real] PASS ${viewport.width}x${viewport.height} sourceHead=${SOURCE_HEAD} actualSha=${ACTUAL_CHECKOUT_SHA} tree=${ACTUAL_CHECKOUT_TREE}`);
  await writeFile(path.join(ARTIFACT_DIR, `viewport-${viewport.width}x${viewport.height}.json`), JSON.stringify({
    sourceHead: SOURCE_HEAD,
    actualCheckoutSha: ACTUAL_CHECKOUT_SHA,
    actualCheckoutTree: ACTUAL_CHECKOUT_TREE,
    viewport,
    evidence
  }, null, 2));
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
