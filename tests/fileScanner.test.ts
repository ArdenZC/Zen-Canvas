import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanRoots } from "../src/core/fileScanner";

let tempDir = "";
const testRoot = path.join(process.cwd(), ".tmp-tests");

beforeEach(async () => {
  await fs.mkdir(testRoot, { recursive: true });
  tempDir = await fs.mkdtemp(path.join(testRoot, "fma-scan-"));
});

afterEach(async () => {
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

describe("file scanner", () => {
  it("scans regular files and skips hidden or ignored directories", async () => {
    await fs.writeFile(path.join(tempDir, "visible.pdf"), "visible");
    await fs.mkdir(path.join(tempDir, ".hidden"));
    await fs.writeFile(path.join(tempDir, ".hidden", "secret.pdf"), "secret");
    await fs.mkdir(path.join(tempDir, "node_modules"));
    await fs.writeFile(path.join(tempDir, "node_modules", "package.js"), "module");

    const result = await scanRoots([tempDir]);
    const names = result.files.map((file) => file.name);

    expect(names).toContain("visible.pdf");
    expect(names).not.toContain("secret.pdf");
    expect(names).not.toContain("package.js");
    expect(result.roots[0].path).toBe(tempDir);
  });

  it("records missing roots without failing the scan", async () => {
    const missing = path.join(tempDir, "missing-folder");
    const result = await scanRoots([missing]);

    expect(result.files).toHaveLength(0);
    expect(result.skipped[0].path).toBe(missing);
    expect(result.skipped[0].reason).toBeTruthy();
  });

  it("detects duplicate files by size and hash", async () => {
    await fs.writeFile(path.join(tempDir, "a.txt"), "same");
    await fs.writeFile(path.join(tempDir, "b.txt"), "same");
    await fs.writeFile(path.join(tempDir, "c.txt"), "different");

    const result = await scanRoots([tempDir]);
    const duplicates = result.files.filter((file) => file.hash);

    expect(duplicates).toHaveLength(2);
    expect(new Set(duplicates.map((file) => file.hash)).size).toBe(1);
  });
});
