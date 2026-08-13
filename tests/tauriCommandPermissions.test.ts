import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type CommandClass =
  | "READ_ONLY"
  | "MAIN_WINDOW_MUTATION"
  | "MAIN_WINDOW_DIAGNOSTIC_MUTATION"
  | "SEARCH_WINDOW_LIFECYCLE"
  | "EXPLICITLY_SHARED_READ";

type GuardExpectation =
  | "none"
  | "require_main_window"
  | "require_search_window"
  | "search_or_main_window";

type CommandContract = {
  command: string;
  source: string;
  class: CommandClass;
  guard: GuardExpectation;
};

const mainSource = readFileSync(resolve("src-tauri/src/main.rs"), "utf8");
const buildSource = readFileSync(resolve("src-tauri/build.rs"), "utf8");
const matrixSource = readFileSync(
  resolve("docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md"),
  "utf8",
);
const databaseBootstrapperSource = readFileSync(
  resolve("src/components/DatabaseBootstrapper.tsx"),
  "utf8",
);
const dbCommandsSource = readFileSync(resolve("src-tauri/src/db/commands.rs"), "utf8");
const mainCapability = JSON.parse(
  readFileSync(resolve("src-tauri/capabilities/default.json"), "utf8"),
) as { permissions: string[] };
const searchCapability = JSON.parse(
  readFileSync(resolve("src-tauri/capabilities/search.json"), "utf8"),
) as { permissions: string[] };

const source = (relativePath: string) => resolve(relativePath);

function groupedContracts(
  className: CommandClass,
  guard: GuardExpectation,
  relativePath: string,
  commands: readonly string[],
): CommandContract[] {
  return commands.map((command) => ({
    command,
    source: relativePath,
    class: className,
    guard,
  }));
}

// This is the authorization metadata, not a name-based heuristic. Every command
// that can mutate state is listed with its real command source and expected guard.
// Read-only commands are closed over below only after these explicit sets have
// been checked against both COMMANDS and generate_handler!.
const explicitContracts: CommandContract[] = [
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/db/commands.rs", [
    "init_db",
    "insert_file",
    "remove_files_by_paths",
    "upsert_files_by_paths",
    "create_user_tag",
    "update_user_tag",
    "delete_user_tag",
    "mutate_file_user_tags",
    "create_library_saved_view",
    "update_library_saved_view",
    "delete_library_saved_view",
    "create_organization_plan",
    "update_organization_plan_decisions",
    "update_organization_plan_group_decision",
    "refresh_organization_plan",
    "cancel_organization_plan",
    "delete_organization_plan",
    "analyze_organization_plan_items",
    "execute_organization_plan",
    "create_user_rule_v2",
    "update_user_rule_v2",
    "set_user_rule_enabled_v2",
    "delete_user_rule_v2",
    "execute_rules_for_scope_v2",
  ]),
  ...groupedContracts(
    "MAIN_WINDOW_MUTATION",
    "require_main_window",
    "src-tauri/src/db/learning.rs",
    ["confirm_classification", "correct_classification"],
  ),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/global_index/commands.rs", [
    "start_global_index",
    "pause_global_index",
    "resume_global_index",
    "rebuild_global_index_source",
    "set_global_index_source_enabled",
    "add_managed_scope",
    "remove_managed_scope",
    "update_managed_scope_policy",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/content.rs", [
    "set_content_scope_policy",
    "start_content_run",
    "cancel_content_run",
    "rebuild_content_artifact",
    "delete_content_artifact",
    "purge_content_scope",
    "understand_content_artifacts",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/rule_proposals.rs", [
    "create_rule_proposal",
    "regenerate_rule_proposal",
    "cancel_rule_proposal",
    "delete_rule_proposal",
    "replace_rule_proposal_candidate",
    "apply_rule_proposal",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/settings.rs", [
    "save_settings",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/ai/settings.rs", [
    "save_ai_settings",
  ]),
  ...groupedContracts(
    "MAIN_WINDOW_DIAGNOSTIC_MUTATION",
    "require_main_window",
    "src-tauri/src/ai/trace.rs",
    ["clear_ai_request_traces"],
  ),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/ai/classification.rs", [
    "classify_files_with_ai",
    "classify_selected_files_with_ai",
    "cancel_ai_classification",
  ]),
  ...groupedContracts(
    "MAIN_WINDOW_DIAGNOSTIC_MUTATION",
    "require_main_window",
    "src-tauri/src/ai/debug.rs",
    ["debug_ai_classification_once"],
  ),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/ai/cleanup.rs", [
    "analyze_cleanup_candidates_with_ai",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/app_control.rs", [
    "quit_app",
    "mark_main_window_ready",
    "acknowledge_main_window_ready",
    "register_global_search_hotkey",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/scanner.rs", [
    "start_managed_scan",
    "cancel_scan_run",
    "retry_interrupted_scan",
    "scan_directory",
    "cancel_scan",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/dedupe.rs", [
    "cancel_dedupe",
    "start_dedupe_run",
    "retry_dedupe_run",
    "cancel_dedupe_run",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/analysis.rs", [
    "start_analysis_run",
    "cancel_analysis_run",
    "retry_analysis_run",
    "set_analysis_finding_decision",
    "revalidate_analysis_finding",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/file_ops.rs", [
    "execute_moves",
    "restore_moves",
    "cancel_operations",
  ]),
  ...groupedContracts("MAIN_WINDOW_MUTATION", "require_main_window", "src-tauri/src/storage_analyzer.rs", [
    "start_storage_cleanup_scan",
    "cancel_storage_cleanup_scan",
    "move_cleanup_candidates_to_safe_trash",
    "restore_cleanup_trash_items",
    "cancel_cleanup_restore",
  ]),
  ...groupedContracts("SEARCH_WINDOW_LIFECYCLE", "search_or_main_window", "src-tauri/src/app_control.rs", [
    "activate_search_result",
  ]),
  ...groupedContracts("SEARCH_WINDOW_LIFECYCLE", "require_search_window", "src-tauri/src/app_control.rs", [
    "search_window_ready",
    "resize_search_window",
    "hide_search_window_command",
  ]),
  ...groupedContracts("SEARCH_WINDOW_LIFECYCLE", "none", "src-tauri/src/app_control.rs", [
    "get_search_window_state",
  ]),
  ...groupedContracts("EXPLICITLY_SHARED_READ", "none", "src-tauri/src/global_index/commands.rs", [
    "search_global_entries",
    "open_global_search_result",
    "reveal_global_search_result",
  ]),
  ...groupedContracts("EXPLICITLY_SHARED_READ", "none", "src-tauri/src/settings.rs", [
    "get_settings",
  ]),
  ...groupedContracts("EXPLICITLY_SHARED_READ", "none", "src-tauri/src/runtime_capabilities.rs", [
    "get_runtime_capabilities",
  ]),
  ...groupedContracts("READ_ONLY", "require_main_window", "src-tauri/src/content.rs", [
    "get_content_scope_policy",
    "get_content_catalog_revision",
    "preview_content",
    "get_content_run",
    "list_content_runs",
    "get_active_content_run_for_file",
    "query_content_run_items",
    "get_content_artifact",
    "query_content_artifacts",
  ]),
];

function handlerCommands(): string[] {
  const handlerBlock = mainSource.match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? "";
  return [...handlerBlock.matchAll(/zen_canvas_tauri::(?:[a-z0-9_]+::)+([a-z0-9_]+)/g)].map(
    (match) => match[1],
  );
}

function manifestCommands(): string[] {
  const commandsBlock = buildSource.match(/const COMMANDS:[\s\S]*?= &\[([\s\S]*?)\];/)?.[1] ?? "";
  return [...commandsBlock.matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
}

function permissionFor(command: string): string {
  return `allow-${command.replaceAll("_", "-")}`;
}

function matrixCommands(): string[] {
  return [...matrixSource.matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map((match) => match[1]);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchingBrace(sourceText: string, openIndex: number): number {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let lineComment = false;
  let blockComment = false;
  let rawDelimiter: string | null = null;

  for (let index = openIndex; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    const next = sourceText[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (rawDelimiter) {
      if (sourceText.startsWith(rawDelimiter, index)) {
        index += rawDelimiter.length - 1;
        rawDelimiter = null;
      }
      continue;
    }
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "r" && (next === '"' || next === "#")) {
      const rawStart = sourceText.slice(index).match(/^r(#+)?"/);
      if (rawStart) {
        const hashes = rawStart[1] ?? "";
        rawDelimiter = `"${hashes}#`;
        index += rawStart[0].length - 1;
        continue;
      }
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return index;
  }
  return -1;
}

function functionBody(sourceText: string, command: string): { signature: string; body: string } | null {
  const commandFunction = new RegExp(
    `#\\[(?:tauri::)?command\\](?:\\s*#\\[[^\\]]+\\])*\\s*(?:pub\\s+)?(?:async\\s+)?fn\\s+${escapeRegExp(command)}\\b`,
    "g",
  );
  const functionMatch = commandFunction.exec(sourceText);
  if (!functionMatch || functionMatch.index === undefined) return null;
  const functionStart = functionMatch.index + functionMatch[0].lastIndexOf("fn ");
  const openIndex = sourceText.indexOf("{", functionStart + functionMatch[0].length);
  if (openIndex < 0) return null;
  const closeIndex = matchingBrace(sourceText, openIndex);
  if (closeIndex < 0) return null;
  return {
    signature: sourceText.slice(functionStart, openIndex),
    body: sourceText.slice(openIndex + 1, closeIndex),
  };
}

function readSource(relativePath: string): string {
  return readFileSync(source(relativePath), "utf8");
}

const manifest = manifestCommands();
const handler = handlerCommands();
const explicitByCommand = new Map(explicitContracts.map((contract) => [contract.command, contract]));
const residualReadOnlyContracts: CommandContract[] = manifest
  .filter((command) => !explicitByCommand.has(command))
  .map((command) => ({
    command,
    source: "",
    class: "READ_ONLY" as const,
    guard: "none" as const,
  }));
const contracts = [...explicitContracts, ...residualReadOnlyContracts];
const contractByCommand = new Map(contracts.map((contract) => [contract.command, contract]));

describe("Tauri command permission contract", () => {
  it("keeps AppManifest and invoke_handler command sets identical", () => {
    expect(manifest).toEqual(handler);
    expect(new Set(manifest).size).toBe(manifest.length);
  });

  it("has explicit metadata for every registered command", () => {
    expect(new Set(contracts.map((contract) => contract.command)).size).toBe(contracts.length);
    expect([...contractByCommand.keys()].sort()).toEqual([...manifest].sort());
    expect(matrixCommands().sort()).toEqual([...manifest].sort());
    expect(explicitContracts.filter((contract) => contract.class === "MAIN_WINDOW_MUTATION").length).toBeGreaterThan(0);
    expect(explicitContracts.some((contract) => contract.class === "MAIN_WINDOW_DIAGNOSTIC_MUTATION")).toBe(true);
    expect(explicitContracts.some((contract) => contract.class === "SEARCH_WINDOW_LIFECYCLE")).toBe(true);
    expect(explicitContracts.some((contract) => contract.class === "EXPLICITLY_SHARED_READ")).toBe(true);
  });

  it("grants exactly one main capability permission to every registered command", () => {
    const defaultCommands = mainCapability.permissions
      .filter((permission) => permission.startsWith("allow-"))
      .map((permission) => permission.slice("allow-".length).replaceAll("-", "_"));
    const searchCommands = searchCapability.permissions
      .filter((permission) => permission.startsWith("allow-"))
      .map((permission) => permission.slice("allow-".length).replaceAll("-", "_"));

    expect(new Set(defaultCommands).size).toBe(defaultCommands.length);
    expect(new Set(searchCommands).size).toBe(searchCommands.length);
    expect(defaultCommands.filter((command) => !manifest.includes(command))).toEqual([]);
    expect(searchCommands.filter((command) => !manifest.includes(command))).toEqual([]);
    expect([...new Set([...defaultCommands, ...searchCommands])].sort()).toEqual([...manifest].sort());
  });

  it("documents every command exactly once", () => {
    for (const command of manifest) {
      const row = `| \`${command}\` |`;
      expect(matrixSource.split(row).length - 1).toBe(1);
    }
  });

  it("checks every main-window mutation function body independently", () => {
    const mutationContracts = explicitContracts.filter(
      (contract) =>
        contract.class === "MAIN_WINDOW_MUTATION" ||
        contract.class === "MAIN_WINDOW_DIAGNOSTIC_MUTATION",
    );
    expect(mutationContracts.length).toBeGreaterThan(0);

    for (const contract of mutationContracts) {
      const sourceText = readSource(contract.source);
      const parsed = functionBody(sourceText, contract.command);
      expect(parsed, `${contract.command} function body`).not.toBeNull();
      expect(parsed?.signature, `${contract.command} window parameter`).toMatch(
        /\b(?:WebviewWindow|Window)\s*</,
      );
      const body = parsed?.body ?? "";
      const guardIndex = body.indexOf("require_main_window");
      expect(guardIndex, `${contract.command} guard`).toBeGreaterThanOrEqual(0);

      // The guard must be the first statement (or the condition of the first
      // statement), so a sibling function's guard cannot satisfy this check.
      const prefix = body.slice(0, guardIndex).trim();
      expect(
        prefix === "" || /^if\s*$/.test(prefix),
        `${contract.command} guard ordering`,
      ).toBe(true);
    }
  });

  it("keeps search-window lifecycle functions on their declared boundary", () => {
    for (const contract of explicitContracts.filter(
      ({ class: className }) => className === "SEARCH_WINDOW_LIFECYCLE",
    )) {
      const parsed = functionBody(readSource(contract.source), contract.command);
      expect(parsed, `${contract.command} function body`).not.toBeNull();
      const body = parsed?.body ?? "";
      if (contract.guard === "require_search_window") {
        expect(body).toContain("require_search_window");
      } else if (contract.guard === "search_or_main_window") {
        expect(body).toContain("SEARCH_WINDOW_LABEL");
        expect(body).toContain("validate_search_window_cas");
        expect(body).toContain("require_main_window");
      } else {
        expect(body).not.toContain("require_main_window");
        expect(body).not.toContain("require_search_window");
      }
    }
  });

  it("keeps the search window on the bounded global-search and lifecycle allowlist", () => {
    expect(searchCapability.permissions).toEqual([
      "core:default",
      "allow-get-settings",
      "allow-search-global-entries",
      "allow-open-global-search-result",
      "allow-reveal-global-search-result",
      "allow-get-runtime-capabilities",
      "allow-activate-search-result",
      "allow-get-search-window-state",
      "allow-search-window-ready",
      "allow-resize-search-window",
      "allow-hide-search-window-command",
    ]);
    expect(searchCapability.permissions).not.toContain("core:window:allow-hide");
    expect(searchCapability.permissions).not.toContain("allow-search-files");
    expect(searchCapability.permissions).not.toContain("allow-get-paged-files");
    expect(searchCapability.permissions.some((permission) =>
      explicitContracts.some(
        (contract) =>
          contract.class === "MAIN_WINDOW_MUTATION" && permission === permissionFor(contract.command),
      ),
    )).toBe(false);
  });

  it("keeps database initialization out of the search window", () => {
    expect(searchCapability.permissions).not.toContain("allow-init-db");
    expect(databaseBootstrapperSource).toContain("isSearchWindowMode");
    expect(databaseBootstrapperSource).toContain("if (isSearchWindowMode)");
  });

  it("does not expose legacy whole-object Rule mutations", () => {
    expect(dbCommandsSource).not.toContain("pub fn save_user_rule<");
    expect(dbCommandsSource).not.toContain("pub fn delete_user_rule<");
    expect(dbCommandsSource).not.toContain("pub fn get_user_rules(");
    expect(manifest).not.toEqual(
      expect.arrayContaining(["save_user_rule", "delete_user_rule", "get_user_rules"]),
    );
    expect(mainCapability.permissions).not.toContain("allow-save-user-rule");
    expect(mainCapability.permissions).not.toContain("allow-delete-user-rule");
  });
});
