import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(path, "utf8");
const frontend = ["src/views/automation/AutomationWorkspace.tsx", "src/views/automation/AutomationIntentEditor.tsx", "src/views/automation/useAutomationIntents.ts", "src/api/automationApi.ts"];
const backend = ["commands", "repository", "service", "types", "mod"].map((name) => `src-tauri/src/db/automation/${name}.rs`);

describe("manual Automation has no execution or idle authority", () => {
  it("checks actual frontend call expressions and imported owners", () => {
    const forbidden = /execute|dryRun|delete.*file|cleanup|shell|process|setInterval|setTimeout|Worker|watch|schedule/i;
    for (const path of frontend) {
      const file = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) expect(ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : "", path).not.toMatch(forbidden);
        if (ts.isImportDeclaration(node)) expect(node.moduleSpecifier.getText(file), path).not.toMatch(/execution|cleanup|worker|scheduler|operationApi/i);
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
  });
  it("bounds the Rust orchestration owner calls and shared materializer", () => {
    const production = backend.map(read).join("\n");
    expect(production).not.toMatch(/std::(?:fs|process|thread)|tokio::|execute_organization_plan|get_organization_plan_dry_run|update_organization_plan_decision|executeMoves|execute_cleanup|Command::new|\.spawn\(|interval\(/);
    const service = read("src-tauri/src/db/automation/service.rs");
    const databaseCalls = [...service.matchAll(/self\s*\.\s*([a-z_]+)\s*\(/g)].map((match) => match[1]);
    expect(new Set(databaseCalls)).toEqual(new Set(["conn", "run_automation_intent", "admit_automation_analysis", "get_organization_plan", "list_managed_scopes", "analyze_organization_plan_items"]));
    expect(service).toContain("LibrarySelectionV1::AllMatching");
    expect(service).toContain("request_id: run.id.clone()");
    expect(service).toContain("eligible.chunks(100)");
    const materializer = read("src-tauri/src/db/queries/organization/materialize.rs");
    expect(materializer).toContain("current_organization_proposal");
    expect(materializer).not.toMatch(/execute_organization|dry_run|accept|std::fs|std::process|legacy_proposal/);
  });
  it("classifies Generate plan as state mutation and excludes Search capability", () => {
    const search = read("src-tauri/capabilities/search.json");
    expect(search).not.toContain("automation");
    const matrix = read("docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md");
    const row = matrix.split("\n").find((line) => line.includes("`run_automation_intent_manual`"));
    expect(row).toContain("main_state_mutation");
    expect(row).not.toMatch(/FILESYSTEM|FILE_MUTATION/);
  });
});
