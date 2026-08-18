# W2-R2 — Thumbnail Consumability Remediation

Status: future gated remediation taskbook — not started by R0.

R2 is a prerequisite for W2-02 production. It owns the narrow W1-to-W2 seam
that proves a Browse presentation entry can become a safe thumbnail request
without guessing identity or bypassing Read Gate.

## Problem established by R0

The public ThumbnailRequest shape in src/types/fileWorkspace.ts and
src/api/fileWorkspaceApi.ts exposes optional sourceGeneration. The backend
thumbnail service in src-tauri/src/file_workspace/thumbnail/service.rs rejects
an ephemeral request when sourceGeneration is absent and also revalidates
session, entry and source-version identity. No production frontend UI producer
currently proves the generation required by that request.

Integration and performance tests copy BrowsePage.enumerationId into
source_generation. R0 found no reviewed W1 contract proving that enumeration
publication identity equals thumbnail source generation. That test convenience
must not become a production inference.

## Scope

- inspect the public Browse-to-thumbnail producer and consumer boundary;
- choose, with architecture/security review, the narrowest truthful solution:
  backend-owned derivation, an explicit validated opaque token, or a safe
  contract simplification;
- preserve session isolation, stale enumeration rejection, entry identity,
  source-version/Read Gate checks and thumbnail cache authority;
- define missing/unknown-generation behavior as fail-closed or unavailable,
  never fabricated;
- add focused Windows-safe and macOS-safe contract tests for success,
  stale enumeration, cross-session mismatch, missing/unknown generation and
  cancellation/cleanup;
- update the W1-to-W2 consumer evidence so the final W2-02 audit can identify
  a real producer, not only a type or mock.

## Prohibitions

Do not set sourceGeneration equal to enumerationId merely because both are
opaque strings. Do not use UI keys, display paths, raw paths, request IDs or
page-local counters as thumbnail identity. Do not move Read Gate, thumbnail
cache, scheduler or filesystem authority into the renderer. Do not add W2-02
presentation UI, a shared selection store or W2-03/W2-04 work.

## Required evidence

- public API/request construction is traceable from a real Browse entry;
- the producer carries the complete source context needed for validation;
- stale and cross-session requests fail closed;
- a valid request reaches the existing W1 service/cache path;
- source-version/read eligibility remains backend-authoritative;
- tests do not claim provider/native parity that was not run;
- exact-head CI and applicable platform evidence are recorded.

## Exit gate

R2 is complete only when a reviewer can answer “what produces the truthful
thumbnail source identity?” from current code and tests, with no copy/guess
step. The result must be classified HARD PASS, OBSERVED, UNVERIFIED, DEFERRED
or BLOCKED. R2 then hands the evidence to the final W1-to-W2 consumer
verification; it does not start W2-02 production.
