export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function trackPageSecurity(page, appOrigin) {
  const errors = [];
  const networkViolations = [];
  const blobRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ kind: "console", text: message.text() });
  });
  page.on("pageerror", (error) => errors.push({ kind: "pageerror", text: String(error) }));
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("blob:")) {
      blobRequests.push(url);
      return;
    }
    if (!url.startsWith(`${appOrigin}/`) && url !== appOrigin && !url.startsWith("ws:") && !url.startsWith("wss:")) {
      networkViolations.push({ kind: "request", url });
    }
  });
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (!url.startsWith(`${appOrigin}/`) && url !== appOrigin) networkViolations.push({ kind: "navigation", url });
  });
  return { errors, networkViolations, blobRequests };
}

export async function waitForApp(page, label) {
  await page.waitForSelector("#root");
  await page.waitForFunction(() => document.title.trim().length > 0 && document.body.textContent?.trim().length > 0);
  const identity = await page.evaluate(() => ({
    title: document.title,
    frameworkOverlay: Boolean(document.querySelector("vite-error-overlay, .vite-error-overlay"))
  }));
  assert(identity.title.includes("Zen"), `${label}: unexpected page title ${identity.title}`);
  assert(!identity.frameworkOverlay, `${label}: framework error overlay mounted`);
}

export async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > window.innerWidth + 1,
    body: document.body.scrollWidth > window.innerWidth + 1,
    workspace: [...document.querySelectorAll(".file-library-workspace")].some((element) => element.scrollWidth > element.clientWidth + 1),
    preview: [...document.querySelectorAll('[data-preview-shell="true"]')].some((element) => element.scrollWidth > element.clientWidth + 1)
  }));
  assert(!Object.values(overflow).some(Boolean), `${label}: horizontal overflow ${JSON.stringify(overflow)}`);
}

export async function openLibrary(page) {
  await page.getByRole("button", { name: "File Library", exact: true }).click();
  await page.waitForSelector('.file-library-workspace[data-mode="library"]');
  const allIndexed = page.getByRole("button", { name: "View all indexed files", exact: true });
  if (await allIndexed.count() > 0 && await allIndexed.first().isVisible()) await allIndexed.first().click();
  const list = page.locator('[data-shared-file-list="true"][data-shared-file-list-source="library"]');
  await list.waitFor({ state: "visible" });
  await list.locator('[role="option"]').first().waitFor({ state: "visible" });
  return list;
}

export async function chooseLibraryFile(page, name) {
  const list = await openLibrary(page);
  const search = page.locator('[data-file-library-local-search="true"]');
  await search.fill(name);
  await page.waitForFunction(() => document.querySelector('[data-library-source-owner="query-v2"]')?.getAttribute("data-library-provenance") === "query-v2-snapshot");
  const item = list.locator('[role="option"]').filter({ hasText: name }).first();
  await item.waitFor({ state: "visible" });
  const itemId = await item.getAttribute("id");
  await item.click();
  await page.waitForFunction((id) => {
    const row = id === null ? null : document.getElementById(id);
    return row?.getAttribute("aria-selected") === "true"
      && row.closest('[role="listbox"]')?.getAttribute("aria-activedescendant") === id;
  }, itemId);
  return { list, item, itemId };
}

export async function settlePreview(page, label) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.evaluate(() => window.__zcW302?.resolveAll());
    await page.evaluate(() => window.__zcW306?.resolveAllAssets());
    await page.evaluate(() => Promise.resolve());
    const state = await page.locator('[data-preview-shell="true"]').getAttribute("data-preview-state").catch(() => null);
    const representationReady = state !== "content"
      || await page.locator("[data-preview-representation]").count() > 0;
    if (state !== null && !["resolving", "loading"].includes(state) && representationReady) return state;
  }
  const diagnostics = await page.evaluate(() => ({
    phase: document.querySelector('[data-preview-shell="true"]')?.getAttribute("data-preview-state") ?? null,
    w302: window.__zcW302 ? JSON.parse(JSON.stringify(window.__zcW302)) : null,
    w306: window.__zcW306 ? JSON.parse(JSON.stringify(window.__zcW306)) : null,
    w309: window.__zcW309 ? JSON.parse(JSON.stringify(window.__zcW309)) : null
  }));
  throw new Error(`${label}: Preview did not settle ${JSON.stringify(diagnostics)}`);
}

export async function openFloating(page, surface, label) {
  await surface.focus();
  if (await surface.getAttribute("aria-activedescendant") === null) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForSelector('[data-preview-host="zen-floating"]');
  const state = await settlePreview(page, label);
  assert(state !== "error", `${label}: Preview entered generic error`);
  return state;
}

export async function closeFloating(page, label) {
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-preview-shell="true"]', { state: "detached" });
  assert(await page.locator('[data-preview-shell="true"]').count() === 0, `${label}: Preview remained mounted`);
}

export async function assertPreviewSecurity(page, label, allowBlob = false) {
  const attributes = await page.locator('[data-preview-content] [href], [data-preview-content] [src], [data-preview-content] [action]')
    .evaluateAll((elements) => elements.map((element) => ({
      tag: element.tagName,
      value: element.getAttribute("href") ?? element.getAttribute("src") ?? element.getAttribute("action") ?? ""
    })));
  const violations = allowBlob ? attributes.filter(({ value }) => !value.startsWith("blob:")) : attributes;
  assert(violations.length === 0, `${label}: resource-bearing Preview attributes ${JSON.stringify(violations)}`);
  assert(await page.locator('[data-preview-content] script, [data-preview-content] iframe, [data-preview-content] object, [data-preview-content] embed').count() === 0,
    `${label}: executable/resource element mounted`);
  if (!allowBlob) {
    assert(await page.locator('[data-preview-content] img').count() === 0, `${label}: textual Preview mounted an image`);
  }
}
