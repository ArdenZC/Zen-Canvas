import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

// Presentation evidence only: this intentionally uses the existing browser mock.
const artifactDir = path.resolve(process.env.PM02A_EVIDENCE_DIR ?? ".tmp-tests/pm02a-browser-evidence");
await mkdir(artifactDir, { recursive: true });
const server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
try {
  for (const scenario of [
    { name: "desktop-blocked", width: 1440, height: 960, language: "en", query: "" },
    { name: "narrow-pending", width: 760, height: 900, language: "en", query: "pm02a-analysis=queued" },
    { name: "desktop-current-zh", width: 1440, height: 960, language: "zh", query: "pm01-organize=ready" }
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height } });
    await context.addInitScript((language) => {
      localStorage.setItem("zc-onboarding-complete", "true"); localStorage.setItem("zc-language", language);
    }, scenario.language);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push({ scenario: scenario.name, message: error.message }));
    await page.goto(`${baseUrl}?${scenario.query}`);
    const en = scenario.language === "en";
    await page.getByRole("button", { name: en ? "Settings" : "设置", exact: true }).first().click();
    await page.getByRole("button", { name: en ? "Automation" : "自动化", exact: true }).first().click();
    await page.getByRole("heading", { name: en ? "Automation" : "自动化", exact: true }).last().waitFor();
    const create = page.getByRole("button", { name: en ? "Create intent" : "创建意图", exact: true });
    await create.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(en ? "Intent title" : "意图名称", { exact: true }).fill(en ? "Prepare documents for review" : "准备审核文档");
    await dialog.getByLabel(en ? "File query" : "文件查询", { exact: true }).fill("report");
    // Exercise reusable selected-root configuration, then retain all-enabled roots.
    await dialog.getByRole("radio", { name: en ? "Selected locations" : "指定位置", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "Zen", exact: true }).check();
    await dialog.getByRole("radio", { name: en ? "All enabled locations" : "全部已启用位置", exact: true }).check();
    if (scenario.name === "desktop-blocked") await page.screenshot({ path: path.join(artifactDir, "desktop-editor.png"), fullPage: true });
    await dialog.getByRole("button", { name: en ? "Save" : "保存", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    if (!await create.evaluate((element) => element === document.activeElement)) throw new Error("Create dialog did not restore focus");
    const generate = page.getByRole("button", { name: en ? "Generate plan" : "生成计划", exact: true });
    await generate.click();
    const open = page.getByRole("button", { name: en ? "Open plan" : "打开计划", exact: true });
    await open.waitFor();
    const text = await page.locator("article").innerText();
    const expected = scenario.name === "desktop-blocked" ? "Needs attention" : scenario.name === "narrow-pending" ? "Analysis requested" : "计划已生成";
    if (!text.includes(expected)) throw new Error(`Expected ${expected}: ${text}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error("Horizontal viewport overflow");
    await page.screenshot({ path: path.join(artifactDir, `${scenario.name}.png`), fullPage: true });
    await open.click();
    await page.getByRole("heading", { name: en ? "Organize Files" : "整理文件", exact: true }).first().waitFor();
    await page.getByRole("button", { name: en ? "Settings" : "设置", exact: true }).first().click();
    await page.getByRole("button", { name: en ? "Automation" : "自动化", exact: true }).first().click();
    await page.getByRole("button", { name: en ? "Advanced Rules" : "高级规则", exact: true }).click();
    await page.getByRole("heading", { name: en ? "Rule Library" : "规则库", exact: true }).last().waitFor();
    results.push({ ...scenario, pass: true, expected, horizontalOverflow: overflow, planHandoff: true, advancedRules: true, focusRestored: true });
    await context.close();
  }
  if (errors.length) throw new Error(`Browser page errors: ${JSON.stringify(errors)}`);
  await writeFile(path.join(artifactDir, "measurements.json"), JSON.stringify({ evidenceBoundary: "Browser mock presentation; not native or provider acceptance", results, pageErrors: errors }, null, 2) + "\n");
  console.log(JSON.stringify({ artifactDir, results }, null, 2));
} finally { await browser.close(); await server.close(); }
