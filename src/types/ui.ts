import type { makeTranslator } from "../i18n.js";

export type View = "scanner" | "cleanup" | "organize" | "library" | "preview" | "automation" | "restore" | "settings";
export type AutomationSurface = "intents" | "advanced-policies";
export type ThemeMode = "system" | "light" | "dark";
export type Density = "default" | "compact";
export type Translator = ReturnType<typeof makeTranslator>;
export type { CloseBehavior } from "./domain";
