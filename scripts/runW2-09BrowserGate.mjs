import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createServer } from "vite";

const SOURCE_HEAD = process.env.W209_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? "local";
const ACTUAL_CHECKOUT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ACTUAL_CHECKOUT_TREE = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const TASK_TEMP_DIR = path.resolve(".tmp-tests/w2-09-browser-runtime");
const ARTIFACT_DIR = path.resolve(".tmp-tests/w2-09-browser-gate");

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
  ...(process.env.W209_CHROMIUM_EXECUTABLE ? { executablePath: process.env.W209_CHROMIUM_EXECUTABLE } : {})
});

try {
  for (const viewport of [{ width: 1600, height: 900 }, { width: 980, height: 680 }]) {
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
      await page.goto(`${baseUrl}?w2-04-browser-fixture=source-owner&w2-05-browser-fixture=interaction&w2-09-browser-fixture=platform`, { waitUntil: "commit" });
      await page.getByRole("button", { name: "File Library", exact: true }).click();
      await page.waitForSelector('.file-library-workspace[data-mode="library"]');

      const navigationToggle = page.locator('[data-file-library-nav-toggle="true"]');
      await navigationToggle.waitFor({ state: "visible" });
      if (await navigationToggle.getAttribute("aria-expanded") === "true") {
        await page.locator('[data-file-library-navigation-panel="true"]').waitFor({ state: "visible" });
      } else {
        await navigationToggle.click();
        await page.locator('[data-file-library-navigation-panel="true"]').waitFor({ state: "visible" });
      }

      for (const name of ["All files", "Types", "Saved Views", "Tags"]) {
        await page.getByRole("button", { name, exact: true }).waitFor({ state: "visible" });
      }
      const imageItem = page.locator('[data-file-library-navigation-item="type:Image"]');
      await imageItem.waitFor({ state: "visible" });
      await imageItem.click();
      await page.locator('[data-file-library-navigation-item="type:Image"][aria-current="page"]').waitFor();
      await page.locator('[data-library-source-owner][data-library-query-file-types="Image"]').waitFor();
      await page.getByRole("button", { name: "All files", exact: true }).click();
      await page.locator('[data-file-library-navigation-item="all"][aria-current="page"]').waitFor();
      if (viewport.width !== 1600) {
        await page.locator('[data-side-sheet="true"] button[aria-label="Close navigation"]').click();
        await page.locator('[data-file-library-navigation-panel="true"]').waitFor({ state: "detached" });
      }
      await page.getByRole("button", { name: "Back", exact: true }).click();
      if (viewport.width !== 1600) {
        await navigationToggle.click();
        await page.locator('[data-file-library-navigation-panel="true"]').waitFor({ state: "visible" });
      }
      await page.locator('[data-file-library-navigation-item="type:Image"][aria-current="page"]').waitFor();
      await page.locator('[data-library-source-owner][data-library-query-file-types="Image"]').waitFor();
      const tagsGroup = page.locator('[data-file-library-navigation-group="tags"]');
      await tagsGroup.waitFor({ state: "visible" });
      const workTag = tagsGroup.locator('[data-file-library-navigation-item="tag:mock-tag-work"]');
      await workTag.waitFor({ state: "visible" });
      await workTag.click();
      await tagsGroup.locator('[data-file-library-navigation-item="tag:mock-tag-work"][aria-current="page"]').waitFor();
      await page.locator('[data-library-source-owner][data-library-query-tags="mock-tag-work"]').waitFor();

      const locationItems = page.locator('[data-file-library-location]');
      await locationItems.first().waitFor({ state: "visible" });
      const unmanaged = page.locator('[data-file-library-location-managed="false"]');
      await unmanaged.first().waitFor({ state: "visible" });
      if (await unmanaged.first().getByRole("button").isEnabled() !== true) throw new Error("Backend-confirmed unmanaged location was unexpectedly disabled");
      if (await unmanaged.first().getByRole("button").getAttribute("aria-label").then((label) => !label?.includes("Browse only"))) throw new Error("Unmanaged location did not expose its calm Browse-only status");
      const unavailable = page.locator('[data-file-library-location="managed:mock-offline-root"] button');
      await unavailable.waitFor({ state: "visible" });
      if (await unavailable.isEnabled()) throw new Error("Backend-confirmed unavailable location was unexpectedly activatable");
      if (await page.locator('[data-file-library-navigation-panel="true"]').getByRole("button", { name: /add.+library/iu }).count() !== 0) throw new Error("Navigation invented an Add to Library action without an admission seam");

      if (viewport.width === 980) {
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector('[data-file-library-nav-toggle="true"]')?.getAttribute("aria-expanded") === "false");
        await page.waitForFunction(() => document.activeElement?.matches('[data-file-library-nav-toggle="true"]') === true);
      } else {
        await page.getByRole("button", { name: "Browse only", exact: false }).first().click();
        await page.waitForSelector('.file-library-workspace[data-mode="browse"]');
      }

      const overflow = await page.evaluate(() => ({
        documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        bodyOverflow: document.body.scrollWidth > window.innerWidth + 1
      }));
      if (overflow.documentOverflow || overflow.bodyOverflow) throw new Error(`unexpected horizontal overflow: ${JSON.stringify(overflow)}`);
      if (consoleErrors.length || pageErrors.length) throw new Error(JSON.stringify({ consoleErrors, pageErrors }));
      console.log(`[w2-09-real] PASS ${viewport.width}x${viewport.height} sourceHead=${SOURCE_HEAD} actualSha=${ACTUAL_CHECKOUT_SHA} tree=${ACTUAL_CHECKOUT_TREE}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
  await rm(ARTIFACT_DIR, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  await rm(TASK_TEMP_DIR, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
