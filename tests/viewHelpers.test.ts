import { describe, expect, it } from "vitest";
import { formatDisplayPath } from "../src/utils/viewHelpers";

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
});
