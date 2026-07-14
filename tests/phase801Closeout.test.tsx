import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileTypeIcon, fileIconForRecord } from "../src/components/FileTypeIcon";
import { formatCount, makeTranslator } from "../src/i18n";
import { createAIProcessingModeController } from "../src/store/useAIProcessingModeStore";
import type { AISettings, FileRecord } from "../src/types/domain";
import {
  AI_CLASSIFICATION_PRESET_VALUES,
  aiSettingsEqual,
  applyAIClassificationPreset,
  resolveAIClassificationPreset
} from "../src/views/settings/aiSettingsModel";

function settings(overrides: Partial<AISettings> = {}): AISettings {
  return {
    enabled: false,
    provider: "openai_compatible",
    preset: "deepseek",
    baseUrl: "https://api.deepseek.com",
    chatPath: "/chat/completions",
    apiKey: "",
    model: "deepseek-v4-flash",
    temperature: 0,
    maxTokens: 1024,
    batchSize: 10,
    classificationConcurrency: 2,
    timeoutSeconds: 120,
    sendFullPath: false,
    sendParentPath: true,
    classificationMode: "ai_first",
    cleanupAiEnabled: true,
    forceJsonOutput: false,
    enableThinking: false,
    reasoningEffort: null,
    extraBodyJson: null,
    ...overrides
  };
}

function file(fileType: string, extension: string): Pick<FileRecord, "file_type" | "extension"> {
  return { file_type: fileType as FileRecord["file_type"], extension };
}

describe("Phase 8.0.1 closeout models", () => {
  it("uses singular-safe Spotlight result counts", () => {
    const en = makeTranslator("en");
    const zh = makeTranslator("zh");
    const keys = { zero: "matchesFoundZero", one: "matchesFoundOne", other: "matchesFoundOther" } as const;
    expect(formatCount(en, 0, keys)).toBe("No results found");
    expect(formatCount(en, 1, keys)).toBe("1 result found");
    expect(formatCount(en, 2, keys)).toBe("2 results found");
    expect(formatCount(zh, 1, keys)).toBe("找到 1 个结果");
  });

  it("keeps other dynamic item counts singular-safe and English copy clean", () => {
    const en = makeTranslator("en");
    const itemKeys = { zero: "historyBatchItemsZero", one: "historyBatchItemsOne", other: "historyBatchItemsOther" } as const;
    expect(formatCount(en, 0, itemKeys)).toBe("0 items");
    expect(formatCount(en, 1, itemKeys)).toBe("1 item");
    expect(formatCount(en, 2, itemKeys)).toBe("2 items");
    expect(en("aiProviderDeepSeek")).toBe("DeepSeek — Recommended");
    expect(en("aiProviderOllama")).toBe("Ollama — Local model");
    expect(en("viewDescOrganize")).toBe("Files are moved only after you review the Preview and explicitly confirm execution.");
  });

  it("keeps classification presets derived from the actual values", () => {
    const standard = settings();
    const fast = applyAIClassificationPreset(standard, "fast");
    expect(fast).toMatchObject(AI_CLASSIFICATION_PRESET_VALUES.fast);
    expect(resolveAIClassificationPreset(fast)).toBe("fast");
    expect(resolveAIClassificationPreset({ ...fast, maxTokens: 333 })).toBe("custom");
    expect(aiSettingsEqual(standard, { ...standard })).toBe(true);
  });

  it("does not let an older AI load overwrite a newer published runtime state", async () => {
    const controller = createAIProcessingModeController();
    let resolveOld!: (value: AISettings) => void;
    const oldLoad = new Promise<AISettings>((resolve) => { resolveOld = resolve; });
    const pending = controller.load(() => oldLoad);
    const published = settings({ enabled: true, provider: "ollama" });
    controller.publish(published);
    resolveOld(settings({ enabled: false, provider: "openai_compatible" }));
    await pending;
    expect(controller.getState()).toMatchObject({ status: "ready", settings: published });
  });

  it("shares semantic file icons across supported file categories", () => {
    expect(fileIconForRecord(file("Folder", ""))).toBeDefined();
    expect(fileIconForRecord(file("Document", ".pdf"))).toBeDefined();
    expect(fileIconForRecord(file("ArchivePackage", ".zip"))).toBeDefined();
    expect(fileIconForRecord(file("Installer", ".exe"))).toBeDefined();
    expect(fileIconForRecord(file("Image", ".png"))).toBeDefined();
    expect(renderToStaticMarkup(<FileTypeIcon file={file("Document", ".pdf")} />)).toContain('aria-hidden="true"');
  });
});
