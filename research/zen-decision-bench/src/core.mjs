import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const TASKS = Object.freeze([
  "domain_type",
  "purpose",
  "lifecycle",
  "risk_level",
  "suggested_action",
  "existing_folder_choice"
]);

export const SPLITS = Object.freeze(["pilot", "dev", "test"]);
export const PROVENANCE_CATEGORIES = Object.freeze(["synthetic", "repo_fixture", "manual_nonsensitive"]);
export const AMBIGUITY = Object.freeze(["none", "bounded", "material"]);
export const SCORE_CLASSES = Object.freeze([
  "correct",
  "acceptable_alternate",
  "correct_abstain",
  "unnecessary_abstain",
  "unsafe_overclaim",
  "incorrect",
  "invalid_output",
  "provider_failure"
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

export function caseContentFingerprint(record) {
  return sha256({
    task: record.task,
    input: record.input,
    context: record.context ?? null,
    choices: record.choices
  });
}

export async function readJsonl(path) {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid_jsonl_line:${index + 1}:${String(error)}`);
      }
    });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateCase(record) {
  const errors = [];
  if (!isObject(record)) return ["record_must_be_object"];
  if (record.schema_version !== "zdb.case.v1") errors.push("schema_version");
  if (typeof record.case_id !== "string" || !record.case_id.trim()) errors.push("case_id");
  if (!TASKS.includes(record.task)) errors.push("task");
  if (!isObject(record.input)) errors.push("input");
  if (record.context !== undefined && !isObject(record.context)) errors.push("context");
  if (!Array.isArray(record.choices) || record.choices.length < 2) errors.push("choices");
  const choiceIds = Array.isArray(record.choices)
    ? record.choices.map((choice) => isObject(choice) && typeof choice.id === "string" ? choice.id : null)
    : [];
  if (choiceIds.some((id) => !id)) errors.push("choice_id");
  if (new Set(choiceIds).size !== choiceIds.length) errors.push("duplicate_choice_id");
  if (!Array.isArray(record.choices) || record.choices.some((choice) => !isObject(choice) || typeof choice.label !== "string" || !choice.label.trim())) {
    errors.push("choice_label");
  }
  if (typeof record.gold !== "string" || (!choiceIds.includes(record.gold) && record.gold !== "abstain")) errors.push("gold");
  if (record.gold === "abstain" && record.abstain_allowed !== true) errors.push("gold_abstain_requires_permission");
  if (record.acceptable !== undefined) {
    if (!Array.isArray(record.acceptable) || record.acceptable.some((id) => typeof id !== "string" || !choiceIds.includes(id) || id === record.gold)) {
      errors.push("acceptable");
    }
  }
  if (typeof record.abstain_allowed !== "boolean") errors.push("abstain_allowed");
  if (!AMBIGUITY.includes(record.ambiguity)) errors.push("ambiguity");
  if (!isObject(record.provenance) || !PROVENANCE_CATEGORIES.includes(record.provenance?.category) || typeof record.provenance?.source !== "string" || !record.provenance.source.trim()) {
    errors.push("provenance");
  }
  if (!SPLITS.includes(record.split)) errors.push("split");
  if (!Array.isArray(record.tags) || record.tags.some((tag) => typeof tag !== "string" || !tag.trim())) errors.push("tags");
  if (record.preference_context !== undefined && !isObject(record.preference_context)) errors.push("preference_context");
  return [...new Set(errors)];
}

export function validatePrediction(record) {
  const errors = [];
  if (!isObject(record)) return ["record_must_be_object"];
  if (record.schema_version !== "zdb.prediction.v1") errors.push("schema_version");
  if (typeof record.case_id !== "string" || !record.case_id.trim()) errors.push("case_id");
  if (!(record.decision === null || typeof record.decision === "string")) errors.push("decision");
  if (!(record.confidence === null || (typeof record.confidence === "number" && record.confidence >= 0 && record.confidence <= 1))) errors.push("confidence");
  if (!(record.latency_ms === null || (typeof record.latency_ms === "number" && record.latency_ms >= 0))) errors.push("latency_ms");
  if (!(record.error === null || typeof record.error === "string")) errors.push("error");
  if (record.error && record.decision !== null) errors.push("error_with_decision");
  return [...new Set(errors)];
}

export function validateDataset(records) {
  const issues = [];
  const ids = new Set();
  const fingerprints = new Map();
  const taskCounts = Object.fromEntries(TASKS.map((task) => [task, 0]));
  const splitCounts = Object.fromEntries(SPLITS.map((split) => [split, 0]));

  records.forEach((record, index) => {
    const errors = validateCase(record);
    if (errors.length) issues.push({ index, case_id: record?.case_id ?? null, errors });
    if (typeof record?.case_id === "string") {
      if (ids.has(record.case_id)) issues.push({ index, case_id: record.case_id, errors: ["duplicate_case_id"] });
      ids.add(record.case_id);
    }
    if (TASKS.includes(record?.task)) taskCounts[record.task] += 1;
    if (SPLITS.includes(record?.split)) splitCounts[record.split] += 1;
    if (!errors.length) {
      const fingerprint = caseContentFingerprint(record);
      const previous = fingerprints.get(fingerprint);
      if (previous && previous.split !== record.split) {
        issues.push({
          index,
          case_id: record.case_id,
          errors: [`cross_split_duplicate:${previous.case_id}:${previous.split}`]
        });
      } else if (!previous) {
        fingerprints.set(fingerprint, { case_id: record.case_id, split: record.split });
      }
    }
  });

  return {
    valid: issues.length === 0,
    count: records.length,
    dataset_hash: sha256(records),
    task_counts: taskCounts,
    split_counts: splitCounts,
    issues
  };
}

export function classifyPrediction(testCase, prediction) {
  if (prediction?.error) return "provider_failure";
  if (!prediction || prediction.decision === null || prediction.decision === undefined) return "invalid_output";
  const decision = prediction.decision;
  const choiceIds = new Set(testCase.choices.map((choice) => choice.id));
  if (decision !== "abstain" && !choiceIds.has(decision)) return "invalid_output";
  if (decision === "abstain") {
    return testCase.gold === "abstain" || testCase.abstain_allowed ? "correct_abstain" : "unnecessary_abstain";
  }
  if (testCase.gold === "abstain") return "unsafe_overclaim";
  if (decision === testCase.gold) return "correct";
  if ((testCase.acceptable ?? []).includes(decision)) return "acceptable_alternate";
  return "incorrect";
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index];
}

export function calibrationMetrics(scored, bins = 10) {
  const samples = scored.filter(({ prediction }) => typeof prediction.confidence === "number");
  if (!samples.length) return { count: 0, ece: null, brier: null, buckets: [] };
  const buckets = Array.from({ length: bins }, (_, index) => ({
    min: index / bins,
    max: (index + 1) / bins,
    count: 0,
    confidence_sum: 0,
    correct_sum: 0
  }));
  let brier = 0;
  for (const item of samples) {
    const confidence = item.prediction.confidence;
    const correct = ["correct", "acceptable_alternate", "correct_abstain"].includes(item.score_class) ? 1 : 0;
    const bucketIndex = Math.min(bins - 1, Math.floor(confidence * bins));
    const bucket = buckets[bucketIndex];
    bucket.count += 1;
    bucket.confidence_sum += confidence;
    bucket.correct_sum += correct;
    brier += (confidence - correct) ** 2;
  }
  let ece = 0;
  const normalized = buckets.filter((bucket) => bucket.count > 0).map((bucket) => {
    const avgConfidence = bucket.confidence_sum / bucket.count;
    const accuracy = bucket.correct_sum / bucket.count;
    ece += (bucket.count / samples.length) * Math.abs(avgConfidence - accuracy);
    return { min: bucket.min, max: bucket.max, count: bucket.count, avg_confidence: avgConfidence, accuracy };
  });
  return { count: samples.length, ece, brier: brier / samples.length, buckets: normalized };
}

export function evaluate(dataset, predictions) {
  const datasetValidation = validateDataset(dataset);
  if (!datasetValidation.valid) {
    throw new Error(`invalid_dataset:${JSON.stringify(datasetValidation.issues)}`);
  }
  const caseMap = new Map(dataset.map((record) => [record.case_id, record]));
  const predictionMap = new Map();
  const predictionIssues = [];
  predictions.forEach((prediction, index) => {
    const errors = validatePrediction(prediction);
    if (errors.length) predictionIssues.push({ index, case_id: prediction?.case_id ?? null, errors });
    if (predictionMap.has(prediction?.case_id)) predictionIssues.push({ index, case_id: prediction?.case_id ?? null, errors: ["duplicate_prediction"] });
    predictionMap.set(prediction?.case_id, prediction);
  });
  if (predictionIssues.length) throw new Error(`invalid_predictions:${JSON.stringify(predictionIssues)}`);

  const scored = dataset.map((testCase) => {
    const prediction = predictionMap.get(testCase.case_id) ?? {
      schema_version: "zdb.prediction.v1",
      case_id: testCase.case_id,
      decision: null,
      confidence: null,
      latency_ms: null,
      error: "missing_prediction"
    };
    return { test_case: testCase, prediction, score_class: classifyPrediction(testCase, prediction) };
  });
  const counts = Object.fromEntries(SCORE_CLASSES.map((scoreClass) => [scoreClass, 0]));
  scored.forEach(({ score_class }) => { counts[score_class] += 1; });
  const total = scored.length || 1;
  const latencies = scored.map(({ prediction }) => prediction.latency_ms).filter((value) => typeof value === "number");
  const accepted = counts.correct + counts.acceptable_alternate + counts.correct_abstain;
  return {
    schema_version: "zdb.summary.v1",
    dataset_hash: datasetValidation.dataset_hash,
    case_count: scored.length,
    counts,
    metrics: {
      exact_accuracy: counts.correct / total,
      acceptable_adjusted_accuracy: accepted / total,
      invalid_output_rate: counts.invalid_output / total,
      abstention_rate: (counts.correct_abstain + counts.unnecessary_abstain) / total,
      unsafe_overclaim_rate: counts.unsafe_overclaim / total,
      provider_failure_rate: counts.provider_failure / total,
      median_latency_ms: percentile(latencies, 0.5),
      p95_latency_ms: percentile(latencies, 0.95)
    },
    calibration: calibrationMetrics(scored),
    scored
  };
}
