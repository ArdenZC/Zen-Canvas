# W5-03 — Distribution / Update Strategy — Decision Audit

Status: **AUTHORIZED WHEN THIS ACTIVATION MERGES — EVIDENCE / PRODUCT-STRATEGY TRACK**

Baseline: `master@86939e7301135bf05e991356376bc77f296236c4`; tree `c8d19ccf9f082efa93e678677a272f4f9db96cb0`.

Suggested branch: `docs/w5-03-distribution-update-strategy`.

## Objective

Make one explicit, evidence-backed first-release decision:

1. use a **manual-download/install update lifecycle** for the first public Zen Canvas release; or
2. authorize a separately reviewed **in-app updater / update-channel implementation** with its own trust, key, version, rollback, artifact and endpoint contracts.

W5-03 is a decision Track first. This activation does **not** authorize silently adding updater code, signing keys, endpoints, manifests, UI, background network checks, a package-version bump, a tag or a GitHub Release.

## Why this Track exists

W5-01 found that no updater/update channel exists and classified that absence as a release-policy gap rather than hidden implementation debt. W5-02 then closed release qualification and artifact-freshness blockers without adding updater behavior.

The repository now has current supported-platform package evidence, so W5-03 can decide distribution/update policy without mixing that decision into release-workflow remediation.

## Required read set

Read before writing the result:

1. `AGENTS.md`
2. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/initiatives/W5-release-hardening.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`
8. `docs/project/tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md`
9. `docs/project/tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md`
10. `.github/workflows/release-build.yml`
11. `package.json`
12. `src-tauri/Cargo.toml`
13. `src-tauri/tauri.conf.json`
14. current official Tauri v2 updater documentation when describing current updater requirements.

## Current evidence to verify

Do not assume these facts from old notes; verify them on the W5-03 baseline:

- no `@tauri-apps/plugin-updater` dependency;
- no `tauri-plugin-updater` Rust dependency;
- no updater plugin registration;
- no updater `pubkey` / `endpoints` configuration;
- no `createUpdaterArtifacts` setting;
- no `latest.json` or equivalent update manifest;
- no production check/download/install update flow;
- current supported distribution artifacts are Windows x64 NSIS and Apple-Silicon DMG;
- current release/tag state remains none;
- no real older public Zen Canvas release artifact exists for a genuine cross-version update test.

## External behavior that matters

When evaluating Tauri's updater, distinguish its update-artifact signature from operating-system code signing.

The Tauri updater currently requires update signatures and states that signature verification cannot be disabled. Its model introduces:

- a long-lived updater public/private key pair;
- private-key custody and recovery requirements;
- updater artifact generation/signatures;
- configured HTTPS update endpoints or a static update manifest such as a GitHub-hosted `latest.json`;
- platform-specific update artifact behavior;
- version-selection/update-install behavior that must be reviewed and tested.

This is **not** the same as Windows Authenticode, Apple Developer ID or Apple notarization. The accepted W4 no-production-signing decision does not automatically forbid an updater signature. However, introducing an updater key is a new durable release trust root/security obligation and must not be smuggled into W5 as a convenience feature.

## Decision criteria

### Prefer manual-download/install for the first release when

- there is no existing public installed population that needs automatic updates;
- there is no real older release fixture for end-to-end cross-version updater acceptance;
- the existing NSIS/DMG distribution path is already the accepted release artifact model;
- an updater would create a new secret/trust-root/endpoint/artifact lifecycle before product need is demonstrated;
- W5's release-hardening goal can be satisfied truthfully without that new subsystem.

### Consider an updater implementation only when

all of the following have a concrete answer:

- product requirement: why manual updates are insufficient now;
- update authenticity: who owns and backs up the updater private key;
- key rotation/recovery: what happens after compromise/loss;
- endpoint/manifest: where update metadata is published and how it is versioned;
- artifacts: exact Windows/macOS updater bundle shapes and provenance;
- privilege/install behavior: especially the current per-machine Windows install model;
- rollback/downgrade policy;
- first real cross-version fixture and acceptance plan;
- UI/network behavior: whether checks are manual/automatic and what user consent/telemetry/network claims apply;
- release qualification integration: how updater artifacts/signatures become part of exact-SHA publication evidence.

If those obligations are not justified by a first-release need, do not implement the updater merely because Tauri provides a plugin.

## Manual-download lifecycle to evaluate

If selected, define the first-release model narrowly:

- GitHub Release is the canonical published distribution surface after W5-06 explicitly authorizes publication;
- Windows users download the versioned x64 NSIS installer;
- Apple-Silicon macOS users download the versioned DMG;
- Zen performs no automatic or background update check;
- Zen does not download/install updates in-app;
- release notes/download guidance must state that updates are manual;
- each later release still requires its own exact-SHA release qualification and platform acceptance;
- do not claim cross-version upgrade acceptance before a real older published artifact exists;
- do not promise automatic rollback/downgrade behavior.

A future updater initiative may replace this policy only through a reviewed transition.

## Required evidence / research questions

The W5-03 result must answer:

1. What updater capability exists in the repository today?
2. What new security/release authorities would Tauri updater introduce?
3. Does any current product requirement require automatic/in-app updates before the first public release?
4. Can a real cross-version updater flow be validated before a first public release exists?
5. Can the first release use the already-qualified NSIS/DMG + GitHub Release model without overstating lifecycle guarantees?
6. What exact condition should trigger future updater reconsideration?
7. Does the decision change W5-04 manual acceptance scope?

## Non-goals

W5-03 decision audit must not:

- add updater dependencies or plugin registration;
- generate/store an updater private key;
- add updater public keys/endpoints/manifests;
- add background network behavior;
- add update UI;
- alter schema or durable product authorities;
- change supported platforms;
- change the no-Authenticode/no-Developer-ID/no-notarization policy;
- bump `0.1.40` solely to manufacture an upgrade fixture;
- create a release/tag;
- reinterpret same-version package evidence as cross-version PASS;
- pull W5-04 manual warning/accessibility/display/provider work into this Track.

## Stop / escalate conditions

Stop and return evidence rather than widening scope if:

- a production updater already exists but was missed by the W5-01 audit;
- a first-release product requirement explicitly depends on automatic updates;
- manual install of a later version would conflict with an accepted installer/data-migration authority;
- Tauri updater integration requires changing a durable security/platform/permission authority beyond a bounded release mechanism;
- the only way to claim updater readiness is to fabricate an older-release fixture or weaken update signature verification.

## Validation

This activation/result path is documentation/evidence only unless a separately reviewed follow-up explicitly authorizes implementation.

Minimum activation validation:

- project governance/docs checks through the repository's docs-only CI route;
- current truth consistently says W5-03 is active decision audit after activation;
- W5-04 and later Tracks remain inactive;
- release/tag remain none.

## Expected result shapes

### If manual-download first release is selected

```text
W5 ACTIVE — implementation
W5-03 COMPLETE / CLOSED
First-release updates = manual download/install
Canonical future publication surface = GitHub Releases
In-app updater = NOT IMPLEMENTED / DEFERRED pending a separately reviewed trigger
Updater signing key / endpoint / manifest = none
Release none
Tag none
W5-04 Supported-Platform Manual Release Acceptance NEXT
```

### If updater is selected

Do **not** implement it inside the decision-result PR. Instead produce a separately reviewed implementation task that freezes its trust/key/endpoint/artifact/version/rollback/permission model before production code changes.
