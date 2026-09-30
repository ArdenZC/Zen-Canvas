import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readJsonl, sha256 } from "../src/core.mjs";
import { buildAssignment, writeAssignment, loadTargetIds, ASSIGNMENT_SEED } from "../preference/signal/build-assignment.mjs";
import { buildHistory, writeHistory } from "../preference/signal/build-history.mjs";
import { loadProfiles, PROFILE_IDS } from "../preference/signal/b2a-artifact-io.mjs";
import { validateAssignment, validateHistory, validateSavedAssignment, validateSavedHistory } from "../preference/signal/validate-b2a.mjs";
const base = new URL("../preference/signal/", import.meta.url);
const profiles = await loadProfiles();
const ids = await loadTargetIds();
const assignment = await readJsonl(new URL("assignment.v1.jsonl", base));
const history = await readJsonl(new URL("history.v1.jsonl", base));
const clone = structuredClone;

// Exact dependency closure, parsed as syntax rather than a filename blacklist.
async function dependencyClosure(entry) {
  const seen = new Map();
  async function visit(url) {
    if (seen.has(url.href)) return;
    const source = await readFile(url, "utf8");
    const ast = ts.createSourceFile(url.href, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports = [];
    function walk(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier) imports.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node)) {
        expect(node.expression.kind === ts.SyntaxKind.ImportKeyword).toBe(false);
        expect(node.expression.getText(ast)).not.toMatch(/^(?:require|eval|Function|fetch|.*\.fetch|.*\.connect)$/u);
      }
      if (ts.isPropertyAccessExpression(node)) expect(node.getText(ast)).not.toMatch(/^process\.env/u);
      ts.forEachChild(node, walk);
    }
    walk(ast);
    seen.set(url.href, imports);
    for (const specifier of imports) {
      if (specifier.startsWith("node:")) expect(["node:crypto", "node:fs/promises", "node:url"]).toContain(specifier);
      else { expect(specifier.startsWith(".")).toBe(true); await visit(new URL(specifier, url)); }
    }
  }
  await visit(new URL(entry, base));
  return [...seen.keys()].map((url) => fileURLToPath(url).replaceAll("\\", "/").split("zen-decision-bench/")[1]).sort();
}
function restrictedBuild(entry, expression, files) {
  const closure = [new URL(entry, base), new URL("b2a-artifact-io.mjs", base), new URL("../../src/core.mjs", base),
    ...(entry === "build-history.mjs" ? [new URL("vocabulary.mjs", base)] : []), ...files.map((file) => new URL(file, base))];
  return execFileSync(process.execPath, ["--permission", ...closure.map((url) => `--allow-fs-read=${fileURLToPath(url)}`),
    "--input-type=module", "-e", expression], { encoding: "utf8", env: {}, cwd: fileURLToPath(base), stdio: ["ignore", "pipe", "pipe"] }).trim();
}
describe("B2A structure and blindness boundary", () => {
  it("pins the frozen output hashes", async () => {
    expect(sha256(assignment)).toBe("4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b");
    expect(sha256(history)).toBe("c2be8a2949c0daef12fe821010b72ca84ef999deb941a6f8bd0505dc8a7e2f44");
    expect((await validateSavedAssignment()).file_sha256).toBe("f05291e3bf421538b66ed2caf8ae599f2fcea4ff3e263f9d9088764091d684ef");
    expect((await validateSavedHistory()).file_sha256).toBe("a463442fcc837bbbfa542a9423b1370cef655c12ffa14e2e3cd3a67d57c6b6af");
  });
  it("refuses to overwrite frozen output", async () => {
    await expect(writeAssignment()).rejects.toThrow("STOP:artifact_already_exists");
    await expect(writeHistory()).rejects.toThrow("STOP:artifact_already_exists");
  });
  it("validates saved assignment and History independently", async () => {
    expect((await validateSavedAssignment()).valid).toBe(true);
    expect((await validateSavedHistory()).valid).toBe(true);
  });
  it("uses the frozen seed, rank derivation and exact balanced ID inventory", () => {
    expect(ASSIGNMENT_SEED).toBe("27418e52bb5e483ef523d2cdc1045dfb17a1ec45238b8f0cf67d431f0163bfaf");
    expect(validateAssignment(assignment, ids).valid).toBe(true);
    expect(new Set(assignment.map((r) => r.case_id))).toEqual(new Set(ids));
    for (const id of PROFILE_IDS) expect(assignment.filter((r) => r.profile_id === id)).toHaveLength(10);
  });
  it("is invariant to both input file orders and accepts only ID projections", () => {
    expect(buildAssignment([...ids].reverse(), [...PROFILE_IDS].reverse())).toEqual(assignment);
    expect(buildAssignment(ids.map((id) => id), profiles.map(({ profile_id }) => profile_id).reverse())).toEqual(assignment);
    expect(() => buildAssignment([...ids.slice(1), ids[1]])).toThrow();
    expect(() => buildAssignment(ids, PROFILE_IDS.slice(1))).toThrow();
  });
  it("rejects reassignment, rank drift and extra authority fields", () => {
    for (const mutate of [r => r[0].profile_id = r[1].profile_id, r => r[0].rank_key = "0".repeat(64),
      r => r[0].gold = "forbidden", r => r.reverse(), r => r.pop()]) {
      const bad = clone(assignment); mutate(bad); expect(() => validateAssignment(bad, ids)).toThrow();
    }
  });
  it("validates chronology, Profile-only values, exact template and correction integrity", () => {
    expect(validateHistory(history, profiles).valid).toBe(true);
    expect(buildHistory([...profiles].reverse())).toEqual(history);
    expect(new Set(history.map((r) => r.evidence.evidence_id)).size).toBe(288);
    for (const id of PROFILE_IDS) expect(history.filter((r) => r.profile_id === id)).toHaveLength(24);
  });
  it("rejects contamination and malformed evidence without reporting content", () => {
    const mutations = [r => r.pop(), r => r[0].profile_id = "unknown", r => r[0].case_id = ids[0],
      r => r[0].evidence.gold = "forbidden", r => r[0].evidence.scope.global_user = true,
      r => r[0].evidence.scope.context_tags = ["invalid"], r => r[0].evidence.observed_at = "2026-09-01T00:00:00.000Z",
      r => r[1].evidence.evidence_id = r[0].evidence.evidence_id, r => r[0].evidence.decision = "folder_1",
      r => r[0].evidence.provenance.category = "repo_fixture", r => r[0].evidence.tags.push(ids[0]),
      r => r.find(x => x.evidence.correction_of).evidence.correction_of = ["missing"],
      r => r.find(x => x.evidence.correction_of).evidence.correction_of = [r.at(-1).evidence.evidence_id],
      r => r.find(x => x.evidence.correction_of).evidence.scope.parent_family = "invalid"];
    for (const mutate of mutations) { const bad = clone(history); mutate(bad); expect(() => validateHistory(bad, profiles)).toThrow(); }
  });
  it("independently checks the pre-registered 24-slot template", () => {
    const patterns = [["explicit_selection", "explicit_selection", "passive_acceptance"],
      ["passive_acceptance", "passive_acceptance", "passive_acceptance"], ["explicit_selection", "passive_acceptance"],
      ["passive_acceptance", "passive_acceptance", "explicit_rejection"],
      ["passive_acceptance", "explicit_correction", "passive_acceptance"],
      ["explicit_selection", "explicit_selection", "passive_acceptance"],
      ["explicit_selection", "passive_acceptance", "explicit_rejection"]];
    let valid = true;
    for (const p of profiles) {
      const rows = history.filter(r => r.profile_id === p.profile_id);
      const tendencies = [...p.tendencies.filter(t => t.task === "existing_folder_choice"), ...p.tendencies.filter(t => t.task === "suggested_action")];
      let index = 0;
      patterns.forEach((pattern, slot) => {
        const first = index;
        pattern.forEach((kind, ordinal) => {
          const e = rows[index++].evidence;
          const t = tendencies[slot];
          valid &&= e.kind === kind && e.task === t.task && e.scope.parent_family === t.scope_parent_family &&
            e.decision === (slot === 4 && ordinal === 0 ? t.contrasted_values[0] : t.preferred_value) &&
            (kind !== "explicit_correction" || e.correction_of[0] === rows[first].evidence.evidence_id);
        });
      });
      for (const t of [tendencies[0], tendencies[4]]) for (let j = 0; j < 2; j++) {
        const e = rows[index++].evidence;
        valid &&= e.kind === "passive_acceptance" && e.task === t.task && e.decision === t.preferred_value &&
          JSON.stringify(Object.keys(e.scope).sort()) === JSON.stringify(["task_family", "workspace"]);
      }
      valid &&= index === 24;
    }
    expect(valid).toBe(true);
  });
  it("declares closed schemas and references unchanged frozen evidence", async () => {
    const schemaRoot = new URL("../schema/", import.meta.url);
    const a = JSON.parse(await readFile(new URL("preference-signal-assignment.v1.schema.json", schemaRoot), "utf8"));
    const h = JSON.parse(await readFile(new URL("preference-signal-history-episode.v1.schema.json", schemaRoot), "utf8"));
    expect(a.additionalProperties).toBe(false); expect(h.additionalProperties).toBe(false);
    expect(a.required).toEqual(["schema_version", "case_id", "rank_key", "rank_index", "profile_id"]);
    expect(h.properties.evidence.$ref).toBe("preference-evidence.v1.schema.json");
  });
  it("proves exact transitive builder dependencies and no network or credentials", async () => {
    const common = ["preference/signal/b2a-artifact-io.mjs", "src/core.mjs"];
    expect(await dependencyClosure("build-assignment.mjs")).toEqual([...common, "preference/signal/build-assignment.mjs"].sort());
    expect(await dependencyClosure("build-history.mjs")).toEqual([...common, "preference/signal/build-history.mjs", "preference/signal/vocabulary.mjs"].sort());
    const a = await readFile(new URL("build-assignment.mjs", base), "utf8");
    const h = await readFile(new URL("build-history.mjs", base), "utf8");
    expect(a).not.toMatch(/history|adjudication|provider|\.task\b|\.choices\b|\.control_class\b|\.family\b|\.tendencies\b|\.gold\b/iu);
    expect(/target|assignment|provider|context_tags|global_user|resolver/iu.test(h)).toBe(false);
  });
  it("builds under runtime filesystem allowlists with no target access for History", () => {
    const h = new URL("build-history.mjs", base).href;
    const io = new URL("b2a-artifact-io.mjs", base).href;
    const a = new URL("build-assignment.mjs", base).href;
    expect(restrictedBuild("build-history.mjs", `import { buildHistory } from ${JSON.stringify(h)}; import { loadProfiles } from ${JSON.stringify(io)}; console.log(buildHistory(await loadProfiles()).length);`, ["profiles.v1.jsonl"])).toBe("288");
    expect(restrictedBuild("build-assignment.mjs", `import { buildAssignment, loadTargetIds } from ${JSON.stringify(a)}; import { loadProfiles } from ${JSON.stringify(io)}; console.log(buildAssignment(await loadTargetIds(), (await loadProfiles()).map(p => p.profile_id)).length);`, ["profiles.v1.jsonl", "targets.v1.jsonl"])).toBe("120");
  });
});
