import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { FileRecord } from "../src/types/domain";
import {
  filePreviewKind,
  lifecycleLabel,
  purposeLabel,
  riskLabel,
  typeLabel
} from "../src/views/fileLibrary/presentation/fileLibraryPresentation";

function file(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: "file-1",
    name: "notes.txt",
    path: "C:/Users/Zen/Documents/notes.txt",
    directory: "C:/Users/Zen/Documents",
    extension: "txt",
    size: 2_000,
    file_type: "Document",
    purpose: "Work",
    lifecycle: "Active",
    context: "project notes",
    risk_level: "Normal",
    hash: null,
    created_at: "2026-07-01T00:00:00Z",
    modified_at: "2026-07-12T00:00:00Z",
    scanned_at: "2026-07-12T00:00:00Z",
    last_seen_at: "2026-07-12T00:00:00Z",
    is_hidden: false,
    is_deleted: false,
    is_duplicate: false,
    suggested_action: "Keep",
    suggested_target_path: "",
    suggested_name: "",
    confidence: 0.8,
    classification_reason: "matches the project context",
    classification_status: "classified",
    matched_rules: [],
    requires_confirmation: false,
    ...overrides
  };
}

describe("File Library presentation helper parity", () => {
  it("preserves every filePreviewKind branch, precedence, and fallback", () => {
    const cases: Array<[string, Parameters<typeof filePreviewKind>[0], ReturnType<typeof filePreviewKind>]> = [
      ["folder", { file_type: "Folder" as FileRecord["file_type"], extension: "anything" }, "folder"],
      ["image by type", { file_type: "Image", extension: "unknown" }, "image"],
      ["image by extension", { file_type: "Document", extension: ".PNG" }, "image"],
      ["pdf by extension", { file_type: "Document", extension: "PDF" }, "pdf"],
      ["deleted image keeps classification precedence", { file_type: "Image", extension: "png", is_deleted: true }, "image"],
      ["stale PDF keeps classification precedence", { file_type: "Document", extension: "pdf", is_stale: true }, "pdf"],
      ["text by code type", { file_type: "Code", extension: "bin" }, "text"],
      ["text by markdown extension", { file_type: "Document", extension: "md" }, "text"],
      ["text by JSON extension", { file_type: "Document", extension: "json" }, "text"],
      ["CSV remains the existing fallback for a Spreadsheet", { file_type: "Spreadsheet", extension: "csv" }, "unsupported"],
      ["audio by type", { file_type: "Audio", extension: "bin" }, "audio"],
      ["video by type", { file_type: "Video", extension: "bin" }, "video"],
      ["archive by type", { file_type: "ArchivePackage", extension: "bin" }, "archive"],
      ["archive by extension", { file_type: "Document", extension: "zip" }, "archive"],
      ["deleted fallback", { file_type: "Other", extension: "bin", is_deleted: true }, "unsupported"],
      ["stale fallback", { file_type: "Other", extension: "bin", is_stale: true }, "unsupported"],
      ["ordinary fallback", { file_type: "Other", extension: "bin" }, "unsupported"]
    ];

    for (const [name, input, expected] of cases) {
      expect(filePreviewKind(input), name).toBe(expected);
    }
  });

  it("preserves all current localized type-label branches", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");
    const values: Array<[FileRecord["file_type"], string, string]> = [
      ["Document", "文档", "Document"],
      ["Image", "图片", "Image"],
      ["Video", "视频", "Video"],
      ["Audio", "音频", "Audio"],
      ["Code", "代码", "Code"],
      ["ArchivePackage", "归档", "Archive"],
      ["Installer", "安装包", "Installer"],
      ["Spreadsheet", "表格", "Spreadsheet"],
      ["Presentation", "演示文稿", "Presentation"],
      ["Other", "其他", "Other"]
    ];

    for (const [value, expectedZh, expectedEn] of values) {
      const record = file({ file_type: value });
      expect(typeLabel(record, zh), value).toBe(expectedZh);
      expect(typeLabel(record, en), value).toBe(expectedEn);
    }

    const unknown = file({ file_type: "Folder" as FileRecord["file_type"] });
    expect(typeLabel(unknown, zh)).toBe("libraryTypeFolder");
    expect(typeLabel(unknown, en)).toBe("libraryTypeFolder");
  });

  it("preserves all current localized purpose, lifecycle, and risk branches plus fallback keys", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");
    const purposes: Array<[FileRecord["purpose"], string, string]> = [
      ["Project", "项目", "Project"],
      ["Teaching", "教学", "Teaching"],
      ["Study", "学习", "Study"],
      ["Work", "工作", "Work"],
      ["Personal", "个人", "Personal"],
      ["Career", "职业", "Career"],
      ["Finance", "财务", "Finance"],
      ["Identity", "身份", "Identity"],
      ["Media", "媒体", "Media"],
      ["Installer", "安装包", "Installer"],
      ["Temporary", "临时", "Temporary"],
      ["Archive", "归档", "Archive"],
      ["Unknown", "未分类", "Unclassified"],
      ["Document", "libraryPurposeDocument", "libraryPurposeDocument"],
      ["Duplicate Review", "libraryPurposeDuplicate Review", "libraryPurposeDuplicate Review"]
    ];
    const lifecycles: Array<[FileRecord["lifecycle"], string, string]> = [
      ["Inbox", "待整理", "Inbox"],
      ["Active", "活跃", "Active"],
      ["Reference", "参考", "Reference"],
      ["Archive", "归档", "Archive"],
      ["Disposable", "可清理", "Disposable"],
      ["Duplicate", "重复", "Duplicate"],
      ["Sensitive", "敏感", "Sensitive"],
      ["Unknown", "libraryLifecycleUnknown", "libraryLifecycleUnknown"],
      ["TrashReview", "libraryLifecycleTrashReview", "libraryLifecycleTrashReview"]
    ];
    const risks: Array<[FileRecord["risk_level"], string, string]> = [
      ["Normal", "正常", "Normal"],
      ["Sensitive", "敏感", "Sensitive"],
      ["System", "系统", "System"],
      ["Unknown", "未知", "Unknown"],
      ["Caution", "libraryRiskCaution", "libraryRiskCaution"]
    ];

    for (const [value, expectedZh, expectedEn] of purposes) {
      const record = file({ purpose: value });
      expect(purposeLabel(record, zh), value).toBe(expectedZh);
      expect(purposeLabel(record, en), value).toBe(expectedEn);
    }
    for (const [value, expectedZh, expectedEn] of lifecycles) {
      const record = file({ lifecycle: value });
      expect(lifecycleLabel(record, zh), value).toBe(expectedZh);
      expect(lifecycleLabel(record, en), value).toBe(expectedEn);
    }
    for (const [value, expectedZh, expectedEn] of risks) {
      const record = file({ risk_level: value });
      expect(riskLabel(record.risk_level, zh), value).toBe(expectedZh);
      expect(riskLabel(record.risk_level, en), value).toBe(expectedEn);
    }
  });
});
