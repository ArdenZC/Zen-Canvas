# W2-R3 — Location Consumability Remediation

Status: future gated remediation taskbook — not started by R0.

R3 is a prerequisite for W2-02 production. It owns the narrow W1-to-W2 seam
that lets a future Browse navigation surface use backend-authorized location
information without treating a renderer projection or display path as
filesystem authority.

## Problem established by R0

LocationDescriptor in src/types/fileWorkspace.ts and
src-tauri/src/file_workspace/location.rs is a non-authoritative projection with
an opaque LocationRef, display metadata and fail-closed capability state.
locationList returns descriptors. browseOpen separately requires a routingHint,
and src-tauri/src/file_workspace/integration/browse.rs resolves that hint in the
backend. No current public descriptor-to-admission/navigation action exists.
WorkspaceRestoreLocator is only non-authoritative restore metadata and must
produce fresh references on restore.

Therefore a future W2 navigation component cannot safely act on a
LocationDescriptor alone. It must not recover a path from display text or map
an opaque reference to a renderer-owned raw path.

## Scope

- define a backend-authorized descriptor-to-admission/navigation seam, or record
  a reviewed reason the descriptor remains non-actionable until a later owner;
- preserve opaque LocationRef and BrowsePathRef semantics;
- keep routing/admission, capability evidence, provider grants and platform
  filesystem strategy backend-owned;
- preserve fail-closed Unknown/Unavailable/Permission behavior;
- define fresh Browse session/path/enumeration references after open and restore;
- add deterministic contract coverage for valid, unavailable, unknown,
  stale/history and cross-session cases on supported Windows and macOS paths;
- prove that navigation handles remain source-specific and cannot become raw
  paths, durable identity, thumbnail identity or byte-read authority.

## Prohibitions

Do not add a generic resolve-any-path command, expose backend paths to the
renderer, use displayName/displayPath as an admission key, treat scanRootId as a
path, infer provider capability from platform/string heuristics, or create a
second location/filesystem authority. Do not implement W2-04 navigation UI,
W2-02 presentation adapters, schema changes or W3/W4 behavior in R3.

## Required evidence

- the action input and backend owner are explicit;
- descriptor capability projection remains separate from admission evidence;
- permission, reconciliation, partial coverage and retry-exhausted states remain
  distinct where applicable;
- restore uses fresh live references and non-authoritative metadata only;
- supported-platform tests are tied to the exact native runner when native
  claims are made;
- exact-head CI and local temporary-artifact cleanup are reported.

## Exit gate

R3 is complete only when a reviewer can trace a future navigation action from a
safe descriptor/intent to backend admission without a renderer path. Classify
the result as HARD PASS, OBSERVED, UNVERIFIED, DEFERRED or BLOCKED. R3 then
hands evidence to final W1-to-W2 verification and does not start W2-02
production.
