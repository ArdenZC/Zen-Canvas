import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const root = process.cwd();
const base = process.env.DOCS_DIFF_BASE?.trim();
const head = process.env.DOCS_DIFF_HEAD?.trim() || "HEAD";

if (!base) {
  throw new Error("DOCS_DIFF_BASE is required");
}

const changedFiles = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMR", base, head],
  { cwd: root, encoding: "utf8" }
)
  .split(/\r?\n/u)
  .map((path) => path.trim())
  .filter(Boolean);

const markdownFiles = changedFiles.filter((path) => /\.mdx?$/iu.test(extname(path)));
const failures = [];

function addFailure(file, message) {
  failures.push(`${file}: ${message}`);
}

function validateFences(file, content) {
  let openFence = null;
  const lines = content.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^ {0,3}(`{3,}|~{3,})/u);
    if (!match) continue;

    const marker = match[1];
    const candidate = { character: marker[0], length: marker.length, line: index + 1 };
    if (!openFence) {
      openFence = candidate;
      continue;
    }

    if (candidate.character === openFence.character && candidate.length >= openFence.length) {
      openFence = null;
    }
  }

  if (openFence) {
    addFailure(file, `unclosed Markdown fence opened at line ${openFence.line}`);
  }
}

function validateConflictMarkers(file, content) {
  const lines = content.split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (/^(<{7}|={7}|>{7})(?:\s|$)/u.test(line)) {
      addFailure(file, `unresolved merge-conflict marker at line ${index + 1}`);
    }
  });
}

function normalizeLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<")) {
    const closing = target.indexOf(">");
    if (closing > 0) target = target.slice(1, closing);
  } else {
    target = target.replace(/\s+(?:"[^"]*"|'[^']*'|\([^)]*\))\s*$/u, "");
  }
  return target;
}

function validateLocalLinks(file, content) {
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of content.matchAll(linkPattern)) {
    const target = normalizeLinkTarget(match[1]);
    if (
      !target ||
      target.startsWith("#") ||
      target.startsWith("/") ||
      target.startsWith("\\") ||
      /^[a-z][a-z0-9+.-]*:/iu.test(target) ||
      target.includes("${{") ||
      target.includes("{{")
    ) {
      continue;
    }

    const pathPart = target.split("#", 1)[0].split("?", 1)[0];
    if (!pathPart) continue;

    let decoded;
    try {
      decoded = decodeURIComponent(pathPart);
    } catch {
      addFailure(file, `invalid percent-encoding in link: ${target}`);
      continue;
    }

    const candidate = resolve(root, dirname(file), decoded);
    if (!existsSync(candidate)) {
      addFailure(file, `broken local link: ${target}`);
    }
  }
}

for (const file of markdownFiles) {
  const absolutePath = resolve(root, file);
  if (!existsSync(absolutePath)) continue;

  const content = readFileSync(absolutePath, "utf8");
  validateConflictMarkers(file, content);
  validateFences(file, content);
  validateLocalLinks(file, content);
}

const remediationDirectory = resolve(root, "docs/remediation");
const remediationIndex = resolve(remediationDirectory, "CODEX_REMEDIATION_INDEX_V1.md");
if (existsSync(remediationIndex)) {
  const indexContent = readFileSync(remediationIndex, "utf8");
  const taskReferences = new Set(
    [...indexContent.matchAll(/`(TASK_[^`/\\]+\.md)`/gu)].map((match) => match[1])
  );

  for (const taskReference of taskReferences) {
    if (!existsSync(resolve(remediationDirectory, taskReference))) {
      addFailure(
        "docs/remediation/CODEX_REMEDIATION_INDEX_V1.md",
        `referenced task document does not exist: ${taskReference}`
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation validation failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Documentation validation passed for ${markdownFiles.length} changed Markdown file(s).`
);
