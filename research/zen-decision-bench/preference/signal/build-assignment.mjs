import { sha256 } from "../../src/core.mjs";
import { PROFILE_HASH, PROFILE_IDS, loadProfiles, readFrozen, saveArtifact, isMain } from "./b2a-artifact-io.mjs";
export const TARGET_HASH = "96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4";
export const TARGET_FILE_HASH = "b414f7510345c95e0629f34780dce1125b0f71c12a84cdf5c555d01d1c5217aa";
export const ASSIGNMENT_SEED = sha256(`zdb-03b-assignment-v1|${PROFILE_HASH}|${TARGET_HASH}`);
export const loadTargetIds = async () => (await readFrozen(new URL("./targets.v1.jsonl", import.meta.url), TARGET_HASH, TARGET_FILE_HASH)).map(({ case_id }) => case_id);
export function buildAssignment(caseIds, profileIds = PROFILE_IDS) {
  if (caseIds.length !== 120 || new Set(caseIds).size !== 120 ||
    JSON.stringify([...profileIds].sort()) !== JSON.stringify(PROFILE_IDS)) throw new Error("invalid_assignment_id_inventory");
  return caseIds.map((case_id) => ({ case_id, rank_key: sha256(`${ASSIGNMENT_SEED}|${case_id}`) }))
    .sort((a, b) => a.rank_key < b.rank_key ? -1 : a.rank_key > b.rank_key ? 1 : 0)
    .map((record, rank_index) => ({ schema_version: "zdb.preference_signal_assignment.v1", ...record,
      rank_index, profile_id: PROFILE_IDS[rank_index % 12] }));
}
export async function writeAssignment() {
  const profiles = await loadProfiles();
  return saveArtifact("assignment", buildAssignment(await loadTargetIds(), profiles.map(({ profile_id }) => profile_id)), {
    schema_version: "zdb.preference_signal_assignment_manifest.v1", schema_identity: "zdb.preference_signal_assignment.v1",
    profile_pack_hash: PROFILE_HASH, target_pack_hash: TARGET_HASH, assignment_seed: ASSIGNMENT_SEED,
    algorithm_identity: "zdb-03b-assignment-v1", rank_index_origin: 0, cases_per_profile: 10,
    status: "FROZEN — DETERMINISTIC FROM OWNER-FROZEN B1 INPUTS" });
}
if (isMain(import.meta.url)) console.log(JSON.stringify(await writeAssignment(), null, 2));
