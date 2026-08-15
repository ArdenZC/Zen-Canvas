# G1 — Engineering OS Installation

Status: active — G1A merged and complete; G1B active

Original draft baseline: `master@0805ff54a17ccaf0aa88bc171e8ff00ee83c6c7d`

Reviewed execution baseline after C0B prerequisites: `master@fb953cadfc3f7c4a376ad6918f23bb53c949b774`

Branch: `chore/engineering-os-g1b`

G1A merge: PR #57, merge commit `c21e5ea9a84da74ac821560ac71a1af17ac26d5c`

## Problem

Zen Canvas has strong production authorities and verification gates, but project governance is distributed across historical remediation/design/QA documents and stage-specific agent instructions. The project needs one stable current-truth layer before the next product initiative begins.

## G1A — Current Truth and workflow foundation

Status: complete — merged through PR #57.

Scope:

- create `docs/project/`;
- establish project status, product map and architecture map;
- establish roadmap, debt and current risk registers;
- establish development/merge/closeout rules;
- add ADR-0001;
- make `AGENTS.md` the stable repository constitution through the current-truth layer;
- retire/delete `CLAUDE.md` during C0B-1; it must not be recreated.

Non-scope:

- production code;
- schema or migration;
- dependencies/lockfiles;
- CI thresholds or workflow behavior;
- runtime authority changes;
- product UI redesign;
- File Library 2.0 implementation.

Acceptance:

- there is exactly one project-level current-status source;
- current platform/schema/version/release facts are correct at the recorded baseline;
- architecture map identifies the current durable authorities and known compatibility bridges;
- development workflow defines exact-head validation, squash closeout and branch deletion;
- `AGENTS.md` no longer claims V4.3 is the active project stage, and retired `CLAUDE.md` is not recreated;
- documentation validation passes for the changed Markdown files.

## G1B — Public docs and evidence convergence

Status: active — starts after the G1A merge.

Scope candidates:

- update `README.md` and `README_en.md` to describe the current product truthfully;
- converge macOS completion evidence so the current index points to one completed record;
- mark old V4.3/current-stage metadata as historical without deleting useful evidence;
- reconcile root-level archived/startup guidance that can still mislead new contributors.

G1B must remain documentation/governance work unless a separate defect is discovered and explicitly scoped.

## Exit

G1 is complete when the current-truth layer is merged, public entrypoints point to it, scattered completion evidence is indexed, `STATUS.md` records G1 as complete and the next approved initiative is explicit.
