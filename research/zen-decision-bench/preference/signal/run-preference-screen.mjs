import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { stableJson } from "../../src/core.mjs";
import { loadScreenInputs, OUT, requirePass, git } from "./screen-inputs.mjs";
import { generateArms, compareScreen } from "./compare-preference-screen.mjs";

export function deterministicComparison(data, identity) {
  const firstArms = generateArms(data.cases, data.baseline);
  const secondArms = generateArms(data.cases, data.baseline);
  requirePass(stableJson(firstArms) === stableJson(secondArms), "deterministic_arm_predictions");
  const first = compareScreen(data, firstArms, identity);
  const second = compareScreen(data, secondArms, identity);
  requirePass(stableJson(first.files) === stableJson(second.files), "deterministic_evidence_bytes");
  return first;
}
export async function freezeScreen(ciPath) {
  requirePass(ciPath, "candidate_ci_file_required");
  const commit = git("rev-parse", "HEAD");
  requirePass(git("status", "--porcelain").length === 0, "clean_candidate_worktree");
  const ci = JSON.parse(await readFile(ciPath, "utf8"));
  requirePass(ci.headSha === commit && ci.conclusion === "success" && ci.status === "completed" && ci.workflowName === "CI" && ci.url === `https://github.com/ArdenZC/Zen-Canvas/actions/runs/${ci.databaseId}`, "candidate_exact_head_ci");
  const identity = { branch: git("branch", "--show-current"), candidate_runner_commit: commit,
    candidate_runner_tree: git("rev-parse", "HEAD^{tree}"), tracked_worktree_clean: true,
    candidate_ci: { headSha: ci.headSha, run_id: ci.databaseId, conclusion: ci.conclusion, url: ci.url },
    determinism: "Two independent arm generations and comparison serializations byte-identical before exclusive freeze" };
  const result = deterministicComparison(await loadScreenInputs(), identity);
  // Atomic directory reservation prevents partial-output overwrite or repeat freeze.
  await mkdir(OUT);
  for (const [name, content] of Object.entries(result.files)) await writeFile(new URL(name, OUT), content, { flag: "wx" });
  return { disposition: result.summary.screen_disposition, endpoint: result.summary.primary_arm_c, hard_gates: result.hardGates };
}
export async function validateScreenEvidence() {
  const saved = JSON.parse(await readFile(new URL("comparison-summary.json", OUT), "utf8"));
  const identity = saved.identity;
  requirePass(identity.candidate_runner_commit === identity.candidate_ci.headSha && identity.candidate_ci.conclusion === "success" && identity.tracked_worktree_clean === true, "saved_candidate_identity");
  requirePass(git("merge-base", "--is-ancestor", identity.candidate_runner_commit, "HEAD") === "", "candidate_ancestor");
  // Evidence must use exactly the code committed at the admitted candidate.
  const paths = ["screen-inputs", "compare-preference-screen", "run-preference-screen"].map(name => `research/zen-decision-bench/preference/signal/${name}.mjs`);
  for (const path of paths) requirePass(git("hash-object", path) === git("rev-parse", `${identity.candidate_runner_commit}:${path}`), `candidate_source_unchanged:${path}`);
  requirePass(identity.candidate_runner_tree === git("rev-parse", `${identity.candidate_runner_commit}^{tree}`), "candidate_tree");
  const { starting_master, ...candidateIdentity } = identity;
  requirePass(starting_master === "0fc3751de02a4acab07ff45dbd6523c8efa35a65", "starting_master");
  const result = deterministicComparison(await loadScreenInputs(), candidateIdentity);
  for (const [name, expected] of Object.entries(result.files)) requirePass(await readFile(new URL(name, OUT), "utf8") === expected, `saved_evidence:${name}`);
  return { valid: true, screen_disposition: result.summary.screen_disposition, hard_gates: result.hardGates.all_pass, checked_artifacts: Object.keys(result.files).length };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(process.argv[2] === "--freeze" ? await freezeScreen(process.argv[3]) : await validateScreenEvidence(), null, 2));
}
