import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

function absolute(relativePath) {
  return resolve(root, relativePath);
}

function readRequired(relativePath) {
  const file = absolute(relativePath);
  if (!existsSync(file)) {
    failures.push(`${relativePath}: required governance file does not exist`);
    return "";
  }
  return readFileSync(file, "utf8");
}

function sectionAfterHeading(markdown, heading) {
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex < 0) return "";
  const contentStart = headingIndex + heading.length;
  const nextHeading = markdown.indexOf("\n## ", contentStart);
  return markdown.slice(contentStart, nextHeading < 0 ? markdown.length : nextHeading);
}

function normalizeTitle(title) {
  return title.replace(/[`*_]/gu, "").trim();
}

const requiredProjectFiles = [
  "docs/project/README.md",
  "docs/project/STATUS.md",
  "docs/project/ARCHITECTURE_MAP.md",
  "docs/project/ROADMAP.md",
  "docs/project/TECH_DEBT.md",
  "docs/project/RISK_REGISTER.md",
  "docs/project/DEVELOPMENT_WORKFLOW.md"
];

for (const relativePath of requiredProjectFiles) readRequired(relativePath);

const statusPath = "docs/project/STATUS.md";
const status = readRequired(statusPath);
const roadmap = readRequired("docs/project/ROADMAP.md");
const agents = readRequired("AGENTS.md");
const architecture = readRequired("docs/project/ARCHITECTURE_MAP.md");
const w0Path = "docs/project/initiatives/W0-file-library-preview.md";
const w0 = readRequired(w0Path);

if (!existsSync(absolute("CLAUDE.md"))) {
  // Expected state: the retired root-level instruction file must stay absent.
} else {
  failures.push("CLAUDE.md: retired root instruction file must not exist");
}

const statusCurrentHeading = "## Current initiative";
const statusCurrentCount = (status.match(/^## Current initiative\s*$/gmu) ?? []).length;
if (statusCurrentCount !== 1) {
  failures.push(`STATUS.md: expected exactly one '${statusCurrentHeading}' section`);
}

const statusCurrent = sectionAfterHeading(status, statusCurrentHeading);
const statusTitleMatch = statusCurrent.match(/^\*\*(.+?)\*\*\s*$/mu);
const statusLineMatch = statusCurrent.match(/^Status:\s*(.+)$/mu);
const initiativeLinkMatch = statusCurrent.match(/\]\((initiatives\/[^)]+\.md)\)/u);

if (!statusTitleMatch) failures.push("STATUS.md: current initiative name is missing");
if (!statusLineMatch) failures.push("STATUS.md: current initiative status is missing");
if (!initiativeLinkMatch) {
  failures.push("STATUS.md: current initiative must link to its initiative record");
} else if (!existsSync(absolute(`docs/project/${initiativeLinkMatch[1]}`))) {
  failures.push(`STATUS.md: linked initiative does not exist: ${initiativeLinkMatch[1]}`);
}

const roadmapCurrentCount = (roadmap.match(/^## Current\s*$/gmu) ?? []).length;
if (roadmapCurrentCount !== 1) {
  failures.push("ROADMAP.md: expected exactly one '## Current' section");
}

const roadmapCurrent = sectionAfterHeading(roadmap, "## Current");
const roadmapTitleMatch = roadmapCurrent.match(/^###\s+(.+?)\s*$/mu);
const roadmapStatusMatch = roadmapCurrent.match(/^Status:\s*(.+)$/mu);
const activeRoadmapInitiatives = roadmapCurrent.match(/^###\s+.+$/gmu) ?? [];

if (activeRoadmapInitiatives.length !== 1) {
  failures.push("ROADMAP.md: current section must contain exactly one initiative");
}
if (!roadmapTitleMatch) failures.push("ROADMAP.md: current initiative name is missing");
if (!roadmapStatusMatch) failures.push("ROADMAP.md: current initiative status is missing");

if (statusTitleMatch && roadmapTitleMatch) {
  const statusTitle = normalizeTitle(statusTitleMatch[1]);
  const roadmapTitle = normalizeTitle(roadmapTitleMatch[1]);
  if (statusTitle !== roadmapTitle) {
    failures.push(`current initiative mismatch: STATUS.md='${statusTitle}' ROADMAP.md='${roadmapTitle}'`);
  }
}

for (const [source, lineMatch] of [
  ["STATUS.md", statusLineMatch],
  ["ROADMAP.md", roadmapStatusMatch]
]) {
  if (lineMatch && !/\bactive\b/iu.test(lineMatch[1])) {
    failures.push(`${source}: current initiative must be active`);
  }
}

const hardcodedAgentPatterns = [
  /^\s*Current(?:\s+project)?\s+(?:phase|stage|task|initiative)\s*[:=]/iu,
  /^\s*Active(?:\s+project)?\s+(?:phase|stage|task|initiative)\s*[:=]/iu,
  /^\s*Current(?:\s+implementation\/repository)?\s+baseline\s*[:=]\s*`?[0-9a-f]{7,}/iu,
  /^\s*Current\s+task\s*[:=]/iu
];

agents.split(/\r?\n/u).forEach((line, index) => {
  if (hardcodedAgentPatterns.some((pattern) => pattern.test(line))) {
    failures.push(`AGENTS.md:${index + 1}: changing project stage/baseline/task must live in STATUS.md`);
  }
});

if (/\bW-1 Open Source Research\s*[—-]\s*completed\b/iu.test(w0)
  && !existsSync(absolute("docs/project/research/file-library-preview/OPEN_SOURCE_SYNTHESIS.md"))) {
  failures.push("W0 initiative declares W-1 complete but OPEN_SOURCE_SYNTHESIS.md is missing");
}

const platformFacts = `${status}\n${agents}\n${architecture}`;
if (!/macOS\s+13(?:\s+or\s+later)?\s+on\s+Apple Silicon/iu.test(platformFacts)) {
  failures.push("platform facts: macOS 13+ Apple Silicon target is missing");
}
for (const token of ["Intel", "Universal", "Rosetta"]) {
  if (!new RegExp(`\\b${token}\\b`, "iu").test(platformFacts)) {
    failures.push(`platform facts: ${token} boundary is missing`);
  }
}

if (failures.length > 0) {
  console.error("Project governance validation failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Project governance validation passed.");
