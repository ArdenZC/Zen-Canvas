import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W204_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const TASK_TEMP_DIR = path.resolve(".tmp-tests/w2-04-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w2-04-browser-gate");

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
  ...(process.env.W204_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W204_CHROMIUM_EXECUTABLE } : {})
});

const CHECKOUT = { sourceHead: SOURCE_HEAD, actualSha: ACTUAL_CHECKOUT_SHA, actualTree: ACTUAL_CHECKOUT_TREE };

async function runScene(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem("zc-onboarding-complete", "true");
    window.localStorage.setItem("zc-language", "en");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  try {
    await page.goto(`${baseUrl}?w2-04-browser-fixture=source-owner`, { waitUntil: "commit" });
    await page.getByRole("button", { name: "File Library", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="library"]');
    await page.getByRole("tab", { name: "Browse", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="browse"][data-detached-browse="true"]');
    await page.getByText("No folder is open. Nothing is being read, indexed, or added to your File Library.", { exact: true }).waitFor();

    const locations = page.locator('[data-browse-location="true"]');
    await locations.first().waitFor();
    if (await locations.count() !== 2) throw new Error(`expected two location descriptors, got ${await locations.count()}`);
    if (await locations.nth(1).getAttribute("data-browse-location-openable") !== "false") throw new Error("unavailable descriptor is actionable");

    await locations.nth(0).locator('[data-browse-location-action="open"]').click();
    await page.waitForSelector('[data-browse-state="current-folder"]');
    await page.waitForSelector('[data-browse-list="true"]');
    if (await page.locator('[data-browse-enumeration-completion="partial"]').count() !== 1) throw new Error("partial Browse publication missing");
    if (await page.locator('[data-browse-entry="true"]').count() !== 2) throw new Error("first Browse page rows missing");
    if (await page.locator('[data-browse-selection-authority="browse-source-local"]').count() !== 1) throw new Error("Browse selection owner marker missing");

    await page.getByRole("button", { name: "Load more", exact: true }).click();
    await page.waitForSelector('[data-browse-enumeration-completion="complete"]');
    if (await page.locator('[data-browse-known-count="4"]').count() !== 1) throw new Error("exact Browse knownCount missing after completion");

    await page.getByRole("button", { name: "Open folder: mock-folder", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-browse-breadcrumbs="true"] button').length >= 2);
    await page.locator('[data-browse-breadcrumbs="true"] button').first().click();
    await page.waitForFunction(() => document.querySelectorAll('[data-browse-breadcrumbs="true"] button').length === 1);
    await page.getByRole("button", { name: "Open folder: mock-folder", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-browse-breadcrumbs="true"] button').length >= 2);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-browse-breadcrumbs="true"] button').length === 1);

    await page.getByRole("tab", { name: "Library", exact: true }).click();
    await page.waitForSelector('.file-library-workspace[data-mode="library"]');
    await page.getByRole("tab", { name: "Browse", exact: true }).click();
    await page.waitForSelector('[data-browse-state="current-folder"]');
    if (await page.locator('[data-browse-entry="true"]').count() !== 2) throw new Error("Browse target was not restored after Library switch");
    if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));

    return { viewport, ...CHECKOUT };
  } finally {
    await context.close();
  }
}

try {
  const results = [
    await runScene({ width: 1600, height: 900 }),
    await runScene({ width: 980, height: 680 })
  ];
  for (const result of results) {
    console.log(`[w2-04-real] PASS ${result.viewport.width}x${result.viewport.height} sourceHead=${result.sourceHead} actualSha=${result.actualSha} tree=${result.actualTree}`);
  }
} finally {
  await browser.close();
  await server.close();
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await rm(TASK_TEMP_DIR, { recursive: true, force: true });
}
