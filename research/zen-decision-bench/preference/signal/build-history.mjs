import { FOLDERS, ACTIONS } from "./vocabulary.mjs";
import { PROFILE_HASH, loadProfiles, saveArtifact, isMain } from "./b2a-artifact-io.mjs";
export const HISTORY_START = "2026-01-05T12:00:00.000Z";
export const HISTORY_STEP_MS = 10 * 24 * 60 * 60 * 1000;
export const GENERATOR_ID = "zdb-03b2a-profile-only-history-v1";
// Pre-registered constants; never adapted to downstream evaluation.
const TEMPLATE = Object.freeze([
  ["explicit_selection", "explicit_selection", "passive_acceptance"],
  ["passive_acceptance", "passive_acceptance", "passive_acceptance"],
  ["explicit_selection", "passive_acceptance"],
  ["passive_acceptance", "passive_acceptance", "explicit_rejection"],
  ["passive_acceptance", "explicit_correction", "passive_acceptance"],
  ["explicit_selection", "explicit_selection", "passive_acceptance"],
  ["explicit_selection", "passive_acceptance", "explicit_rejection"]
]);
export function buildHistory(profiles) {
  return [...profiles].sort((a, b) => a.profile_id.localeCompare(b.profile_id)).flatMap((profile) => {
    const folders = profile.tendencies.filter((t) => t.task === "existing_folder_choice");
    const actions = profile.tendencies.filter((t) => t.task === "suggested_action");
    if (folders.length !== 4 || actions.length !== 3) throw new Error("invalid_history_profile_shape");
    const episodes = [];
    function add(tendency, kind, value, slot, broad = false, correctionOf = null) {
      const allowed = tendency.task === "existing_folder_choice" ? Object.keys(FOLDERS) : ACTIONS.map(({ id }) => id);
      if (!allowed.includes(value)) throw new Error("invalid_history_value");
      const evidence = { schema_version: "zdb.preference_evidence.v1",
        evidence_id: `${profile.profile_id}-history-${String(episodes.length + 1).padStart(3, "0")}`,
        kind, task: tendency.task, decision: value,
        scope: { workspace: profile.primary_workspace_id, task_family: tendency.task,
          ...(!broad ? { parent_family: tendency.scope_parent_family } : {}) },
        observed_at: new Date(Date.parse(HISTORY_START) + episodes.length * HISTORY_STEP_MS).toISOString(),
        ...(correctionOf ? { correction_of: [correctionOf] } : {}),
        provenance: { category: "synthetic", source: GENERATOR_ID },
        tags: [slot, tendency.tendency_id, broad ? "broad" : "specific"] };
      episodes.push({ schema_version: "zdb.preference_signal_history_episode.v1", profile_id: profile.profile_id, evidence });
    }
    [...folders, ...actions].forEach((tendency, i) => {
      const firstId = `${profile.profile_id}-history-${String(episodes.length + 1).padStart(3, "0")}`;
      TEMPLATE[i].forEach((kind, j) => add(tendency, kind,
        i === 4 && j === 0 ? tendency.contrasted_values[0] : tendency.preferred_value,
        i < 4 ? `F${i + 1}` : `A${i - 3}`, false, kind === "explicit_correction" ? firstId : null));
    });
    for (const [tendency, slot] of [[folders[0], "broad_folder"], [actions[0], "broad_action"]]) {
      for (let i = 0; i < 2; i++) add(tendency, "passive_acceptance", tendency.preferred_value, slot, true);
    }
    return episodes;
  });
}
export async function writeHistory() {
  return saveArtifact("history", buildHistory(await loadProfiles()), {
    schema_version: "zdb.preference_signal_history_manifest.v1", schema_identity: "zdb.preference_signal_history_episode.v1",
    profile_pack_hash: PROFILE_HASH, generator_identity: GENERATOR_ID, episodes_per_profile: 24,
    structural_validation: "PENDING — RUN SEPARATE VALIDATOR",
    status: "FROZEN PRE-ADJUDICATION — OWNER CONTENT BLIND",
    owner_state: "HASH FROZEN — OWNER HAS NOT INSPECTED HISTORY CONTENT" });
}
if (isMain(import.meta.url)) console.log(JSON.stringify(await writeHistory(), null, 2));
