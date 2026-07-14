import { describe, expect, it } from "vitest";
import { compactPath, formatDisplayPath } from "../src/utils/viewHelpers";

describe("path display helpers", () => {
  it("formats Windows drive paths with backslashes", () => {
    expect(formatDisplayPath("C:/Users/77588/Desktop/Documents/测试用.txt")).toBe(
      "C:\\Users\\77588\\Desktop\\Documents\\测试用.txt"
    );
    expect(formatDisplayPath("C:/Users/77588/Desktop\\Documents/测试用.txt")).toBe(
      "C:\\Users\\77588\\Desktop\\Documents\\测试用.txt"
    );
  });

  it("keeps unix-style display when the path is not a Windows drive path", () => {
    expect(formatDisplayPath("/Users/zen/Desktop\\Documents/测试用.txt")).toBe(
      "/Users/zen/Desktop/Documents/测试用.txt"
    );
    expect(formatDisplayPath("relative\\Documents/测试用.txt")).toBe("relative/Documents/测试用.txt");
  });

  it("honors explicit platform overrides", () => {
    expect(formatDisplayPath("D:/Organized/Documents/report.docx", "windows")).toBe(
      "D:\\Organized\\Documents\\report.docx"
    );
    expect(formatDisplayPath("D:\\Organized\\Documents\\report.docx", "unix")).toBe(
      "D:/Organized/Documents/report.docx"
    );
  });

  it("uses a middle ellipsis while retaining the path tail for dense history rows", () => {
    const longPath = "C:\\Users\\77588\\Documents\\项目归档\\非常深的文件夹\\2026\\七月\\最终报告.docx";
    const compact = compactPath(longPath, 48);
    expect(compact).toContain("...");
    expect(compact).toContain("最终报告.docx");
    expect(compact).not.toBe(formatDisplayPath(longPath));
    expect(compact.length).toBeLessThan(80);

    const noSpacePath = "D:\\deep\\nested\\folder\\without\\spaces\\archive.zip";
    expect(compactPath(noSpacePath, 40)).toContain("archive.zip");
  });
});
