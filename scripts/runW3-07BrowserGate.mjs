import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";
import { assertCheckoutEvidence } from "./ciEvidence.mjs";

const SOURCE_HEAD = process.env.W307_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const EXPECTED_CHECKOUT_SHA = process.env.W307_EXPECTED_CHECKOUT_SHA ?? null;
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
if (EXPECTED_CHECKOUT_SHA) assertCheckoutEvidence(EXPECTED_CHECKOUT_SHA, ACTUAL_CHECKOUT_SHA);

const TASK_TEMP_DIR = path.resolve(".tmp-tests/w3-07-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w3-07-browser-gate");
const FIXTURE_QUERY = "w3-07-browser-fixture=folders&w3-02-browser-fixture=preview&w3-03-browser-fixture=pinned";

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
  ...(process.env.W307_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W307_CHROMIUM_EXECUTABLE } : {})
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

async function openBrowse(page) {
  if (await page.getByRole("tab", { name: "Browse", exact: true }).count() === 0) {
    await page.getByRole("button", { name: "File Library", exact: true }).click();
  }
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

async function chooseFolder(page, name) {
  const list = await openBrowse(page);
  const search = page.locator('[data-file-library-local-search="true"]');
  await search.fill(name);
  await list.locator('[role="option"]').filter({ hasText: name }).first().waitFor({ state: "visible" });
  await choose(page, list, name);
  return list;
}

async function resolveDeferred(page, label) {
  await page.waitForFunction(() => {
    const shell = document.querySelector('[data-preview-shell="true"]');
    return (window.__zcW302?.pendingStartCount ?? 0) > 0
      && ["resolving", "loading", "content"].includes(shell?.getAttribute("data-preview-state") ?? "");
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
    w302: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null
  }));
  throw new Error(`${label}: deferred Folder Preview did not settle ${JSON.stringify(stats)}`);
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
}

async function openFloatingWhileStarting(page, surface, label) {
  await surface.focus();
  if (await surface.getAttribute("aria-activedescendant") === null) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForSelector('[data-preview-host="zen-floating"]');
  await page.waitForFunction(() => {
    const representation = document.querySelector('[data-preview-host="zen-floating"] [data-preview-representation="folder_summary"]');
    return (window.__zcW302?.pendingStartCount ?? 0) > 0
      && window.__zcW307?.snapshotCalls >= 1
      && representation?.getAttribute("data-preview-completeness") === "partial"
      && representation?.getAttribute("data-preview-folder-state") === "partial";
  });
  const firstInspected = Number(await page.locator('[data-preview-host="zen-floating"] [data-preview-representation="folder_summary"]').getAttribute("data-preview-inspected-entries"));
  await page.waitForFunction((count) => {
    const representation = document.querySelector('[data-preview-host="zen-floating"] [data-preview-representation="folder_summary"]');
    return (window.__zcW307?.snapshotCalls ?? 0) >= 2
      && Number(representation?.getAttribute("data-preview-inspected-entries")) > count;
  }, firstInspected);
  assert(await page.evaluate(() => (window.__zcW302?.pendingStartCount ?? 0) > 0), `${label}: final previewStart resolved too early`);
}

async function assertFolder(page, label, host = "zen-floating", state = null) {
  const representation = page.locator(`[data-preview-host="${host}"] [data-preview-representation="folder_summary"]`);
  try {
    await representation.waitFor({ state: "visible" });
  } catch (error) {
    const diagnostics = await page.evaluate(async (hostName) => ({
      phase: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null,
      hostText: document.querySelector(`[data-preview-host="${hostName}"]`)?.textContent ?? null,
      representations: [...document.querySelectorAll("[data-preview-representation]")].map((element) => element.getAttribute("data-preview-representation")),
      w302: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null,
      w307: window.__zcW307 ? JSON.parse(JSON.stringify(window.__zcW307)) : null,
      decoder: window.__zcW307?.lastSummary === null ? null : await import("/src/api/folderPreviewWire.ts").then((module) => {
        try {
          module.parseFolderSummaryPayload(window.__zcW307?.lastSummary ?? "");
          return "ok";
        } catch (error) {
          return String(error);
        }
      })
    }), host);
    throw new Error(`${label}: FolderSummary missing ${JSON.stringify(diagnostics)} (${String(error)})`);
  }
  assert(["complete", "partial"].includes(await representation.getAttribute("data-preview-folder-state") ?? ""), `${label}: invalid FolderSummary state`);
  if (state !== null) assert(await representation.getAttribute("data-preview-folder-state") === state, `${label}: state mismatch`);
  const limitReason = await representation.getAttribute("data-preview-limit-reason");
  if (state === "complete") assert(limitReason === "none", `${label}: Complete disclosed a limit reason ${limitReason}`);
  else assert(["none", "entry_limit", "deadline"].includes(limitReason ?? ""), `${label}: invalid Partial limit reason ${limitReason}`);
  assert((await representation.textContent())?.includes("Inspected") === true, `${label}: progress label missing`);
  assert((await representation.textContent())?.includes("Accepted children") === true, `${label}: accepted count missing`);
  assert((await representation.textContent())?.includes("C:\\") !== true, `${label}: path-like content rendered`);
  assert(await representation.locator("a").count() === 0, `${label}: FolderSummary rendered navigation links`);
  return representation;
}

async function closeFloating(page, label) {
  await page.locator('[data-preview-host="zen-floating"] [aria-label="Close preview"]').click();
  await page.waitForSelector('[data-preview-shell="true"]', { state: "detached" });
  assert(await page.locator('[data-preview-shell="true"]').count() === 0, `${label}: Floating Preview remained mounted`);
}

async function pin(page, viewport, label, resolveStart = true) {
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
  if (resolveStart && (await page.evaluate(() => window.__zcW302?.pendingStartCount ?? 0)) > 0) await resolveDeferred(page, `${label} staged Pinned Preview`);
}

async function unpin(page, label) {
  await page.locator('[data-preview-unpin="true"]').click();
  await page.waitForFunction(() => document.querySelector('[data-preview-shell="true"]') === null);
  assert(await page.locator('[data-file-library-context-content="preview"]').count() === 0, `${label}: Preview remained mounted after Unpin`);
}

async function runScenario(context, viewport, label, scenario, evidence) {
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
    assert(networkViolations.length === 0, `${label}: unexpected external/resource navigation ${JSON.stringify(networkViolations)}`);
    assert(errors.length === 0, `${label}: console/page errors ${JSON.stringify(errors)}`);
    await assertNoHorizontalOverflow(page, `${label} ${viewport.width}x${viewport.height}`);
    evidence.push({
      label,
      viewport,
      networkViolations,
      w302: await page.evaluate(() => window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null)
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
    await runScenario(context, viewport, "folder-mixed-floating-pinned", async (page) => {
      const list = await chooseFolder(page, "w3-07-mixed-folder");
      await openFloating(page, list, "Mixed folder Floating");
      await assertFolder(page, "Mixed folder Floating", "zen-floating", "complete");
      await pin(page, viewport, "Mixed folder Pin");
      await assertFolder(page, "Mixed folder Pinned", "zen-pinned", "complete");
      await unpin(page, "Mixed folder Unpin");
    }, evidence);

    await runScenario(context, viewport, "folder-empty-and-bounded-scales", async (page) => {
      let list = await chooseFolder(page, "w3-07-empty-folder");
      await openFloating(page, list, "Empty folder Floating");
      const empty = await assertFolder(page, "Empty folder", "zen-floating", "complete");
      assert(await empty.getAttribute("data-preview-inspected-entries") === "0", "Empty folder inspected count was not zero");
      await closeFloating(page, "Empty folder Close");
      await page.reload({ waitUntil: "commit" });
      await assertPageIdentity(page, "100k folder reload");
      list = await chooseFolder(page, "w3-07-100000-folder");
      await openFloating(page, list, "100k folder Floating");
      await assertFolder(page, "100k folder Complete", "zen-floating", "complete");
      await closeFloating(page, "100k folder Close");
      list = await chooseFolder(page, "w3-07-100001-folder");
      await openFloating(page, list, "100001 folder Floating");
      const overLimit = await assertFolder(page, "100001 folder Partial", "zen-floating", "partial");
      assert(await overLimit.getAttribute("data-preview-limit-reason") === "entry_limit", "100001 folder did not disclose entry_limit");
      await closeFloating(page, "100001 folder Close");
    }, evidence);

    await runScenario(context, viewport, "folder-progressive-stale-switch", async (page) => {
      const list = await chooseFolder(page, "w3-07-mixed-folder");
      await openFloatingWhileStarting(page, list, "Progressive mixed folder");
      if (viewport.width <= 980) {
        await closeFloating(page, "Progressive compact close");
        return;
      }
      await pin(page, viewport, "Progressive Pin", false);
      const baselineLate = await page.evaluate(() => window.__zcW302?.lateStarts ?? 0);
      const search = page.locator('[data-file-library-local-search="true"]');
      await search.fill("w3-07-empty-folder");
      await list.locator('[role="option"]').filter({ hasText: "w3-07-empty-folder" }).waitFor({ state: "visible" });
      await choose(page, list, "w3-07-empty-folder", "option", true);
      await page.waitForFunction(() => (window.__zcW302?.pendingStartCount ?? 0) >= 2);
      await resolveDeferred(page, "Progressive stale A to B");
      const stats = await page.evaluate(() => ({
        late: window.__zcW302?.lateStarts ?? 0,
        summary: window.__zcW307?.lastSummary ?? null,
        hostText: document.querySelector('[data-preview-host="zen-pinned"]')?.textContent ?? ""
      }));
      assert(stats.late >= baselineLate + 1, `Progressive stale A did not become a late completion ${JSON.stringify(stats)}`);
      assert(stats.hostText.includes("W3-07 empty folder"), `Stale A published after switch to B ${JSON.stringify(stats)}`);
      await assertFolder(page, "Progressive B final", "zen-pinned", "complete");
      await unpin(page, "Progressive stale switch Unpin");
    }, evidence);

    await runScenario(context, viewport, "folder-latest-wins-no-duplicate-host", async (page) => {
      if (viewport.width <= 980) {
        const compactList = await chooseFolder(page, "w3-07-10000-folder");
        await openFloating(page, compactList, "Compact folder Floating");
        await assertFolder(page, "Compact folder Floating", "zen-floating", "complete");
        await closeFloating(page, "Compact folder Close");
        return;
      }
      const list = await chooseFolder(page, "w3-07-mixed-folder");
      await openFloating(page, list, "Latest-wins folder Floating");
      const host = viewport.width <= 980 ? "zen-floating" : "zen-pinned";
      if (host === "zen-pinned") await pin(page, viewport, "Latest-wins folder Pin");
      const baselineLate = await page.evaluate(() => window.__zcW302?.lateStarts ?? 0);
      const baselineStarted = await page.evaluate(() => window.__zcW302?.started ?? 0);
      const search = page.locator('[data-file-library-local-search="true"]');
      await search.fill("w3-07-empty-folder");
      await list.locator('[role="option"]').filter({ hasText: "w3-07-empty-folder" }).waitFor({ state: "visible" });
      await choose(page, list, "w3-07-empty-folder", "option", true);
      await page.waitForFunction((count) => (window.__zcW302?.started ?? 0) >= count + 1
        && (window.__zcW302?.pendingStartCount ?? 0) > 0, baselineStarted, { timeout: 10_000 });
      await search.fill("w3-07-1000-folder");
      await list.locator('[role="option"]').filter({ hasText: "w3-07-1000-folder" }).waitFor({ state: "visible" });
      await choose(page, list, "w3-07-1000-folder", "option", true);
      await page.waitForFunction((count) => (window.__zcW302?.started ?? 0) >= count + 2, baselineStarted, { timeout: 10_000 });
      await resolveDeferred(page, "Folder latest-wins");
      const stats = await page.evaluate(() => ({
        late: window.__zcW302?.lateStarts ?? 0,
        hosts: document.querySelectorAll('[data-preview-shell="true"]').length
      }));
      assert(stats.late >= baselineLate + 1, `Folder latest-wins did not observe a stale completion ${JSON.stringify(stats)}`);
      assert(stats.hosts === 1, `Folder latest-wins mounted duplicate hosts ${JSON.stringify(stats)}`);
      await assertFolder(page, "Folder latest-wins result", host);
      if (host === "zen-pinned") await unpin(page, "Folder latest-wins Unpin");
      else await closeFloating(page, "Folder latest-wins Close");
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
  console.log(`[w3-07-real] PASS ${viewport.width}x${viewport.height} sourceHead=${SOURCE_HEAD} actualSha=${ACTUAL_CHECKOUT_SHA} tree=${ACTUAL_CHECKOUT_TREE}`);
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
