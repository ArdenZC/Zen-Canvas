import type { AISettings } from "../../types/domain";

export type AIClassificationPresetId = "fast" | "standard" | "detailed" | "custom";

type AIClassificationPresetValues = Pick<AISettings, "batchSize" | "classificationConcurrency" | "maxTokens" | "sendFullPath" | "sendParentPath">;

export const AI_CLASSIFICATION_PRESET_VALUES: Record<Exclude<AIClassificationPresetId, "custom">, AIClassificationPresetValues> = {
  fast: {
    batchSize: 20,
    classificationConcurrency: 2,
    maxTokens: 1024,
    sendFullPath: false,
    sendParentPath: true
  },
  standard: {
    batchSize: 10,
    classificationConcurrency: 2,
    maxTokens: 1024,
    sendFullPath: false,
    sendParentPath: true
  },
  detailed: {
    batchSize: 5,
    classificationConcurrency: 1,
    maxTokens: 2048,
    sendFullPath: true,
    sendParentPath: true
  }
};

export function resolveAIClassificationPreset(settings: Pick<AISettings, keyof AIClassificationPresetValues>): AIClassificationPresetId {
  for (const [id, values] of Object.entries(AI_CLASSIFICATION_PRESET_VALUES) as Array<[Exclude<AIClassificationPresetId, "custom">, AIClassificationPresetValues]>) {
    if (Object.entries(values).every(([key, value]) => settings[key as keyof AIClassificationPresetValues] === value)) return id;
  }
  return "custom";
}

export function applyAIClassificationPreset(settings: AISettings, preset: Exclude<AIClassificationPresetId, "custom">): AISettings {
  return { ...settings, ...AI_CLASSIFICATION_PRESET_VALUES[preset] };
}

export function aiSettingsSignature(settings: AISettings): string {
  return JSON.stringify([
    settings.enabled,
    settings.provider,
    settings.preset,
    settings.baseUrl,
    settings.chatPath,
    settings.apiKey,
    settings.apiKeyConfigured ?? false,
    settings.model,
    settings.temperature,
    settings.maxTokens,
    settings.batchSize,
    settings.classificationConcurrency,
    settings.timeoutSeconds,
    settings.sendFullPath,
    settings.sendParentPath,
    settings.classificationMode,
    settings.cleanupAiEnabled,
    settings.forceJsonOutput,
    settings.enableThinking,
    settings.reasoningEffort,
    settings.extraBodyJson
  ]);
}

export function aiSettingsEqual(left: AISettings, right: AISettings): boolean {
  return aiSettingsSignature(left) === aiSettingsSignature(right);
}
