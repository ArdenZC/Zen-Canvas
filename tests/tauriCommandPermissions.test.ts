import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(resolve("src-tauri/src/main.rs"), "utf8");
const buildSource = readFileSync(resolve("src-tauri/build.rs"), "utf8");
const matrix = readFileSync(resolve("docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md"), "utf8");
const databaseBootstrapperSource = readFileSync(resolve("src/components/DatabaseBootstrapper.tsx"), "utf8");
const mainCapability = JSON.parse(readFileSync(resolve("src-tauri/capabilities/default.json"), "utf8")) as { permissions: string[] };
const searchCapability = JSON.parse(readFileSync(resolve("src-tauri/capabilities/search.json"), "utf8")) as { permissions: string[] };

function handlerCommands() {
  const handlerBlock = mainSource.match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? "";
  return [...handlerBlock.matchAll(/zen_canvas_tauri::(?:[a-z_]+::)+([a-z_]+)/g)].map((match) => match[1]);
}

function manifestCommands() {
  const commandsBlock = buildSource.match(/const COMMANDS:[\s\S]*?= &\[(?<commands>[\s\S]*?)\];/)?.groups?.commands ?? "";
  return [...commandsBlock.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

describe("Tauri command permission contract", () => {
  it("keeps AppManifest and invoke_handler command sets identical", () => {
    expect(manifestCommands()).toEqual(handlerCommands());
    expect(new Set(manifestCommands()).size).toBe(manifestCommands().length);
  });

  it("documents every command exactly once", () => {
    for (const command of manifestCommands()) {
      const row = "| `" + command + "` |";
      expect(matrix.split(row).length - 1).toBe(1);
    }
  });

  it("does not grant search-window mutation or debug permissions", () => {
    const forbidden = manifestCommands()
      .filter((command) => /^(save_|delete_|remove_|insert_|upsert_|execute_|correct_|confirm_|classify_|cancel_|start_|move_|restore_|scan_|register_|debug_)/.test(command));
    for (const command of forbidden) {
      expect(searchCapability.permissions).not.toContain(`allow-${command.replaceAll("_", "-")}`);
    }
    expect(searchCapability.permissions).not.toContain("allow-save-settings");
    expect(searchCapability.permissions).not.toContain("allow-save-ai-settings");
    expect(searchCapability.permissions).not.toContain("allow-debug-ai-classification-once");
  });

  it("keeps database initialization out of the search window", () => {
    expect(searchCapability.permissions).not.toContain("allow-init-db");
    expect(databaseBootstrapperSource).toContain("isSearchWindowMode");
    expect(databaseBootstrapperSource).toContain("if (isSearchWindowMode)");
  });

  it("keeps the mutation defense-in-depth checks in command modules", () => {
    const sourceByCommand = [
      "src-tauri/src/settings.rs",
      "src-tauri/src/ai/settings.rs",
      "src-tauri/src/ai/classification.rs",
      "src-tauri/src/ai/cleanup.rs",
      "src-tauri/src/ai/debug.rs",
      "src-tauri/src/db/commands.rs",
      "src-tauri/src/db/learning.rs",
      "src-tauri/src/scanner.rs",
      "src-tauri/src/dedupe.rs",
      "src-tauri/src/storage_analyzer.rs",
      "src-tauri/src/file_ops.rs",
      "src-tauri/src/app_control.rs"
    ].map((path) => readFileSync(resolve(path), "utf8")).join("\n");
    expect(sourceByCommand).toContain("require_main_window");
    expect(mainCapability.permissions).toContain("allow-save-settings");
    expect(mainCapability.permissions).toContain("allow-save-ai-settings");
    expect(mainCapability.permissions).toContain("allow-execute-moves");
  });
});
