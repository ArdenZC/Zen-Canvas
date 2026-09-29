#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readJsonl, sha256, caseContentFingerprint } from "../../src/core.mjs";
import { FOLDERS, ACTIONS, PURPOSES, LIFECYCLES } from "./vocabulary.mjs";

const folderIds = new Set(Object.keys(FOLDERS));
const actionIds = new Set(ACTIONS.map(({ id }) => id));
const allowedProfile = ["schema_version", "profile_id", "primary_workspace_id", "brief", "tendencies", "exceptions", "provenance"];
const allowedTendency = ["tendency_id", "task", "statement", "context_tags", "preferred_value", "contrasted_values", "qualifier"];
const allowedTarget = ["schema_version", "case_id", "task", "input", "target_at", "choices", "ambiguity", "authoring_tags", "scope_template", "control_class", "explicit_user_truth", "deterministic_rule", "provenance"];
const allowedInput = ["name", "extension", "size", "modified_at_fs", "parent", "is_directory"];
const allowedScope = ["workspace_mode", "task_family", "parent_family"];
const allowedTruth = ["truth_id", "task", "decision", "statement", "scope_template", "asserted_at"];
const allowedRule = ["rule_id", "authority", "task", "decision", "statement", "scope_template", "asserted_at"];
const allowedProvenance = ["category", "source"];
const taskCounts = { existing_folder_choice: 72, suggested_action: 36, purpose: 6, lifecycle: 6 };
const controlCounts = { cold_start_candidate: 12, explicit_truth_control: 6, safety_control: 6, ordinary_preference_signal: 84, non_intervention_control: 12 };
const forbiddenKey = /^(gold|acceptable|abstain_allowed|expected(?:_.*)?|preferred_answer|assigned_profile|profile_id|preference_context|preference_evidence|history|provider_prediction|resolver_recommendation|score_class|weight|confidence|probability)$/iu;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const countBy = (items, key) => Object.fromEntries([...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length]));
const hashFile = (bytes) => createHash("sha256").update(bytes).digest("hex");
function keysExactly(value, allowed, required, issue, where) {
  if (!isObject(value)) { issue(`${where}:not_object`); return false; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issue(`${where}:extra:${key}`);
  for (const key of required) if (!Object.hasOwn(value, key)) issue(`${where}:missing:${key}`);
  return true;
}
function validText(value) { return typeof value === "string" && value.trim().length > 0; }
function validProvenance(value, issue, where) {
  if (!keysExactly(value, allowedProvenance, allowedProvenance, issue, where)) return;
  if (value.category !== "synthetic" || !validText(value.source)) issue(`${where}:synthetic_only`);
}
function forbiddenDeep(value, issue, where) {
  if (Array.isArray(value)) return value.forEach((part, index) => forbiddenDeep(part, issue, `${where}.${index}`));
  if (!isObject(value)) return;
  for (const [key, part] of Object.entries(value)) {
    if (forbiddenKey.test(key)) issue(`${where}:forbidden:${key}`);
    forbiddenDeep(part, issue, `${where}.${key}`);
  }
}

export function analyzeProfiles(records) {
  const issues = [];
  const issue = (message) => issues.push(message);
  if (!Array.isArray(records) || records.length !== 12) issue("profiles:count");
  const workspaceIds = new Set();
  const signatures = new Set();
  const tendencyCounts = {};
  for (const [index, profile] of (Array.isArray(records) ? records : []).entries()) {
    const where = `profile:${index + 1}`;
    if (!keysExactly(profile, allowedProfile, allowedProfile, issue, where)) continue;
    const expectedId = `profile-${String(index + 1).padStart(2, "0")}`;
    if (profile.schema_version !== "zdb.preference_signal_profile.v1" || profile.profile_id !== expectedId) issue(`${where}:identity`);
    if (profile.primary_workspace_id !== `zdb03b-workspace-${String(index + 1).padStart(2, "0")}`) issue(`${where}:workspace_identity`);
    workspaceIds.add(profile.primary_workspace_id);
    if (!validText(profile.brief) || profile.brief.length < 30) issue(`${where}:brief`);
    if (!Array.isArray(profile.exceptions) || !profile.exceptions.some((item) => validText(item) && item.length >= 20)) issue(`${where}:exception`);
    validProvenance(profile.provenance, issue, `${where}:provenance`);
    if (!Array.isArray(profile.tendencies)) { issue(`${where}:tendencies`); continue; }
    const taskCount = { existing_folder_choice: 0, suggested_action: 0 };
    const ids = new Set();
    for (const [j, tendency] of profile.tendencies.entries()) {
      const tw = `${where}:tendency:${j + 1}`;
      if (!keysExactly(tendency, allowedTendency, allowedTendency, issue, tw)) continue;
      if (!validText(tendency.tendency_id) || !tendency.tendency_id.startsWith(`${profile.profile_id}-`) || ids.has(tendency.tendency_id)) issue(`${tw}:id`);
      ids.add(tendency.tendency_id);
      if (!Object.hasOwn(taskCount, tendency.task)) { issue(`${tw}:task`); continue; }
      taskCount[tendency.task]++;
      const choices = tendency.task === "existing_folder_choice" ? folderIds : actionIds;
      if (!choices.has(tendency.preferred_value) || !Array.isArray(tendency.contrasted_values) || tendency.contrasted_values.length < 1 || tendency.contrasted_values.some((v) => !choices.has(v) || v === tendency.preferred_value)) issue(`${tw}:vocabulary`);
      if (!["usually", "often", "tends_to"].includes(tendency.qualifier) || !validText(tendency.statement) || !/\b(usually|often|tends to)\b/iu.test(tendency.statement)) issue(`${tw}:soft_semantics`);
      if (!Array.isArray(tendency.context_tags) || !tendency.context_tags.length || tendency.context_tags.some((tag) => !validText(tag))) issue(`${tw}:context_tags`);
    }
    if (taskCount.existing_folder_choice < 4 || taskCount.suggested_action < 3) issue(`${where}:tendency_minimum`);
    tendencyCounts[profile.profile_id] = taskCount;
    const signature = sha256(profile.tendencies.map(({ task, context_tags, preferred_value, contrasted_values }) => ({ task, context_tags, preferred_value, contrasted_values })));
    if (signatures.has(signature)) issue(`${where}:duplicate_tendency_set`);
    signatures.add(signature);
    if (/zdb03b-target-|prefa-|\bgold\b|\bcase[-_ ]id\b/iu.test(JSON.stringify(profile))) issue(`${where}:case_reference`);
    // IDs and workspace suffixes are identities, not numeric preference strength.
    forbiddenDeep(profile.tendencies, issue, `${where}:tendencies`);
  }
  if (workspaceIds.size !== 12) issue("profiles:workspace_uniqueness");
  return { valid: issues.length === 0, issues, count: records?.length ?? 0, workspace_unique: workspaceIds.size === 12, tendency_counts: tendencyCounts };
}

function validScope(value, task, issue, where) {
  if (!keysExactly(value, allowedScope, allowedScope, issue, where)) return;
  if (!["assigned_profile_primary", "assigned_profile_novel"].includes(value.workspace_mode) || value.task_family !== task || value.parent_family !== "neutral_inbox") issue(`${where}:invalid`);
}
function validChoices(record, issue, where) {
  if (!Array.isArray(record.choices)) { issue(`${where}:choices`); return []; }
  const ids = record.choices.map((choice) => choice?.id);
  for (const choice of record.choices) {
    if (!keysExactly(choice, ["id", "label"], ["id", "label"], issue, `${where}:choice`)) continue;
    if (!validText(choice.id) || !validText(choice.label)) issue(`${where}:choice_shape`);
  }
  if (new Set(ids).size !== ids.length) issue(`${where}:duplicate_choices`);
  let expected;
  if (record.task === "existing_folder_choice") {
    if (![3, 4].includes(ids.length)) issue(`${where}:folder_choice_count`);
    if (ids.some((id) => !folderIds.has(id))) issue(`${where}:folder_identity`);
    if (JSON.stringify(ids) !== JSON.stringify([...ids].sort())) issue(`${where}:folder_order`);
    expected = ids.map((id) => ({ id, label: FOLDERS[id] }));
  } else {
    expected = { suggested_action: ACTIONS, purpose: PURPOSES, lifecycle: LIFECYCLES }[record.task];
  }
  if (!expected || JSON.stringify(record.choices) !== JSON.stringify(expected)) issue(`${where}:canonical_choices`);
  return ids;
}

export function analyzeTargets(records, legacyRecords = []) {
  const issues = [];
  const issue = (message) => issues.push(message);
  if (!Array.isArray(records) || records.length !== 120) issue("targets:count");
  const fingerprints = new Set();
  const legacyFingerprints = new Set(legacyRecords.map(caseContentFingerprint));
  const identityCounts = Object.fromEntries(Object.keys(FOLDERS).sort().map((id) => [id, 0]));
  const choiceSets = {};
  for (const [index, record] of (Array.isArray(records) ? records : []).entries()) {
    const where = `target:${index + 1}`;
    if (!keysExactly(record, allowedTarget, allowedTarget.filter((key) => !["explicit_user_truth", "deterministic_rule"].includes(key)), issue, where)) continue;
    const expectedId = `zdb03b-target-${String(index + 1).padStart(3, "0")}`;
    if (record.schema_version !== "zdb.preference_signal_target.v1" || record.case_id !== expectedId) issue(`${where}:identity`);
    if (!keysExactly(record.input, allowedInput, allowedInput, issue, `${where}:input`)) continue;
    if (!validText(record.input.name) || !validText(record.input.extension) || !record.input.name.endsWith(`.${record.input.extension}`) || !Number.isInteger(record.input.size) || record.input.size < 0 || !Number.isInteger(record.input.modified_at_fs) || record.input.is_directory !== false || !["C:/ZDB03B/Inbox", "C:/ZDB03B/Downloads"].includes(record.input.parent)) issue(`${where}:input_values`);
    if (!validText(record.target_at) || Number.isNaN(Date.parse(record.target_at))) issue(`${where}:target_at`);
    if (!isObject(record.ambiguity) || !["bounded", "material"].includes(record.ambiguity.level) || !Array.isArray(record.ambiguity.axes) || !record.ambiguity.axes.length || Object.keys(record.ambiguity).some((key) => !["level", "axes"].includes(key))) issue(`${where}:ambiguity`);
    if (!Array.isArray(record.authoring_tags) || record.authoring_tags.length < 1 || record.authoring_tags.some((tag) => !validText(tag) || /\b(gold|correct|preferred|answer)\b/iu.test(tag))) issue(`${where}:tags`);
    validScope(record.scope_template, record.task, issue, `${where}:scope`);
    validProvenance(record.provenance, issue, `${where}:provenance`);
    const ids = validChoices(record, issue, where);
    if (record.task === "existing_folder_choice") {
      for (const id of ids) if (Object.hasOwn(identityCounts, id)) identityCounts[id]++;
      const set = ids.join("+"); choiceSets[set] = (choiceSets[set] ?? 0) + 1;
    }
    const fingerprint = caseContentFingerprint({ task: record.task, input: record.input, choices: record.choices, context: { scope_template: record.scope_template } });
    if (fingerprints.has(fingerprint) || legacyFingerprints.has(fingerprint)) issue(`${where}:duplicate_content`);
    fingerprints.add(fingerprint);
    if (record.control_class === "cold_start_candidate") {
      if (record.scope_template?.workspace_mode !== "assigned_profile_novel" || record.explicit_user_truth || record.deterministic_rule) issue(`${where}:cold_start`);
    } else if (record.scope_template?.workspace_mode !== "assigned_profile_primary") issue(`${where}:ordinary_workspace`);
    if (record.control_class === "explicit_truth_control") {
      const truth = record.explicit_user_truth;
      if (!keysExactly(truth, allowedTruth, allowedTruth, issue, `${where}:truth`)) continue;
      if (truth.task !== record.task || !ids.includes(truth.decision) || !validText(truth.statement) || Date.parse(truth.asserted_at) >= Date.parse(record.target_at) || record.deterministic_rule) issue(`${where}:truth_invalid`);
      validScope(truth.scope_template, record.task, issue, `${where}:truth_scope`);
    } else if (record.explicit_user_truth) issue(`${where}:unexpected_truth`);
    if (record.control_class === "safety_control") {
      const rule = record.deterministic_rule;
      if (!keysExactly(rule, allowedRule, allowedRule, issue, `${where}:rule`)) continue;
      if (record.task !== "suggested_action" || rule.authority !== "safety_rule" || rule.task !== record.task || rule.decision !== "review" || !ids.includes(rule.decision) || Date.parse(rule.asserted_at) >= Date.parse(record.target_at) || record.explicit_user_truth) issue(`${where}:rule_invalid`);
      validScope(rule.scope_template, record.task, issue, `${where}:rule_scope`);
    } else if (record.deterministic_rule) issue(`${where}:unexpected_rule`);
    if (["purpose", "lifecycle"].includes(record.task) !== (record.control_class === "non_intervention_control")) issue(`${where}:non_intervention`);
    forbiddenDeep({ ...record, explicit_user_truth: undefined, deterministic_rule: undefined }, issue, where);
    if (/profile-(0[1-9]|1[0-2])|zdb03b-workspace-(0[1-9]|1[0-2])|prefa-[0-9]/iu.test(JSON.stringify(record))) issue(`${where}:foreign_reference`);
  }
  const actualTask = countBy(records, "task");
  const actualControl = countBy(records, "control_class");
  for (const [task, count] of Object.entries(taskCounts)) if (actualTask[task] !== count) issue(`targets:task_count:${task}`);
  for (const [control, count] of Object.entries(controlCounts)) if (actualControl[control] !== count) issue(`targets:control_count:${control}`);
  if (Object.values(identityCounts).some((count) => count === 0 || count > 54)) issue("targets:folder_identity_coverage");
  if (Math.max(...Object.values(choiceSets)) > 12) issue("targets:choice_set_concentration");
  return { valid: issues.length === 0, issues, count: records?.length ?? 0, task_counts: actualTask, control_counts: actualControl, folder_identity_frequency: identityCounts, folder_choice_set_frequency: choiceSets, repeated_choice_set_max: Math.max(...Object.values(choiceSets)) };
}

export async function validateSavedPacks() {
  const profilePath = new URL("./profiles.v1.jsonl", import.meta.url);
  const targetPath = new URL("./targets.v1.jsonl", import.meta.url);
  const [profiles, targets, legacy, profileManifest, targetManifest, profileBytes, targetBytes] = await Promise.all([
    readJsonl(profilePath), readJsonl(targetPath), readJsonl(new URL("../../fixtures/preference-stage-a.v1.jsonl", import.meta.url)),
    readFile(new URL("./profiles.v1.manifest.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("./targets.v1.manifest.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(profilePath), readFile(targetPath)
  ]);
  const profileResult = analyzeProfiles(profiles);
  const targetResult = analyzeTargets(targets, legacy);
  for (const [manifest, records, bytes, result, identity] of [
    [profileManifest, profiles, profileBytes, profileResult, "zdb.preference_signal_profile.v1"],
    [targetManifest, targets, targetBytes, targetResult, "zdb.preference_signal_target.v1"]
  ]) {
    if (manifest.schema_identity !== identity || manifest.count !== records.length || manifest.canonical_sha256 !== sha256(records) || manifest.file_sha256 !== hashFile(bytes) || manifest.status !== "CANDIDATE — OWNER REVIEW REQUIRED" || manifest.owner_state !== "OWNER REVIEW PENDING" || manifest.research_only !== true || manifest.creation_commit !== null) result.issues.push("manifest_mismatch");
    result.valid = result.issues.length === 0;
    result.canonical_sha256 = sha256(records);
    result.file_sha256 = hashFile(bytes);
  }
  if (JSON.stringify(targetManifest.task_counts) !== JSON.stringify(targetResult.task_counts) || JSON.stringify(targetManifest.control_counts) !== JSON.stringify(targetResult.control_counts)) targetResult.issues.push("manifest_counts");
  targetResult.valid = targetResult.issues.length === 0;
  return { valid: profileResult.valid && targetResult.valid, profiles: profileResult, targets: targetResult };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await validateSavedPacks();
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}
