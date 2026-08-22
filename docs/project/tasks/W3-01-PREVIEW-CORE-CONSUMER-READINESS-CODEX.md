# W3-01 — Preview Core Consumer-Readiness

Status: implementation taskbook — review-ready only after exact-head validation

Baseline: `master@e54c788db637e6c6140cf618dd3d7125ea1df8e3` (W3-00 activation)

Branch: `feat/w3-01-preview-core-consumer-readiness`

## Goal

Make the existing W1 Preview Core safe and deterministic for the later W3
hosts and built-in provider Tracks. This Track owns consumer-readiness seams,
not a user-facing Quick Preview host or rich content providers.

## Authority invariants

- `PreviewSession` remains the sole Preview lifecycle, provider-selection and
  publication authority.
- Query V2 / `LibrarySelectionV1`, BrowseService, WorkspaceSession,
  MaterializationReadGate and WorkScheduler remain their existing authorities.
- Renderer and provider-facing contracts contain no filesystem paths, native
  handles or generic byte-read authority.
- Materialization remains explicit; W3-01 does not add hydration or a general
  download action.
- Preview asset bytes, where a future provider publishes them, are bounded,
  opaque, process-local and bound to the current session/request/sourceVersion.
- Zen Floating and Pinned hosts are the only activated host kinds. Native W4
  hosts remain contract-only and are rejected by the W3-01 composition policy.
- TD-015 remains open; legacy Preview/Vault compatibility is not retired here.

## Required read set

- `AGENTS.md`
- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/DEVELOPMENT_WORKFLOW.md`
- `docs/project/CODE_MAINTAINABILITY.md`
- `docs/project/STATUS.md`
- `docs/project/ROADMAP.md`
- `docs/project/ARCHITECTURE_MAP.md`
- `docs/project/TECH_DEBT.md`
- `docs/project/initiatives/W3-preview-platform.md`
- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
- `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
- `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
- `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
- `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
- `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
- `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
- `docs/project/tasks/W1-06-PREVIEW-CONTRACT-CORE-CODEX.md`
- `docs/project/tasks/W1-07-MATERIALIZATION-READ-GATE-CODEX.md`
- `docs/project/tasks/W1-10-INTEGRATION-SURFACE-CODEX.md`
- `docs/project/tasks/W3-00-PREVIEW-PLATFORM-ACTIVATION-CODEX.md`

## Implementation scope

1. Add one production registry composition owner/factory. The registry is
   deterministic, bounded and duplicate-ID rejecting; it may remain empty of
   rich providers in this Track.
2. Define explicit, backend-owned `zen_floating` and `zen_pinned` capability
   matrices. Do not activate W4 native hosts.
3. Project source capabilities from backend-known source kind, entry kind,
   read/materialization state and availability. Never infer them from an
   extension, display path or renderer guess.
4. Make the Rust/TypeScript representation wire exhaustive and strict for
   Metadata, Text, SafeHTML, StructuredTree, Table, Image, Media,
   FolderSummary, ArchiveTree and NativeOpaque, including strict warnings.
5. Add a Preview-specific bounded asset transport seam. Tokens are opaque,
   sourceVersion-bound and revocable; output is bounded; no path conversion or
   generic read API is allowed.
6. Add request/session/sourceVersion-bound progressive publication through a
   bounded callback. Updates have monotonic sequence numbers, reject stale or
   out-of-order publication, and are revoked by switch/cancel/dispose.
7. Preserve shell-first lifecycle transport: create remains synchronous and
   start remains independently cancellable through the existing bounded
   command execution boundary.
8. Keep browser mock and frontend API contracts in parity without adding W3-02
   UI or renderer implementations.

## Hard non-goals / stop conditions

- No Floating/Pinned Quick Preview UI, Space/Esc shortcuts or Context Panel
  integration.
- No Text/Markdown, JSON/YAML/XML, CSV/TSV, Image, Media, Folder or ZIP
  production provider.
- No Finder Quick Look extension, Windows Preview Handler or other W4 native
  integration.
- No schema, durable Preview job/session store, Query V3, second read gate,
  second scheduler, filesystem mutation/recovery authority or plugin SDK.
- No renderer raw path, generic byte-read command, implicit materialization or
  automatic cloud hydration.
- No broad Vault/legacy Preview cleanup and no closure of TD-015.
- Stop for architecture review if the work requires a new durable authority,
  permission architecture, supported platform or existing authority change.

## Required focused tests

- registry composition ownership, deterministic order and duplicate-ID failure;
- Zen host matrices, native host non-activation and capability intersection;
- managed/ephemeral/file/directory/read-state source projections with no
  extension-based inference;
- all representation families, exact serialized shapes and unknown-field /
  unknown-family rejection;
- all warning kinds and error/terminal codes;
- asset token validity, session/request/sourceVersion binding, stale/cancel /
  dispose revocation, capacity and output bounds, and no arbitrary path access;
- progressive partial-to-complete, multiple partial updates, monotonic and
  out-of-order sequence behavior, source switch, cancel, dispose, cleanup,
  provider failure fallback and terminal-condition non-bypass;
- shell-before-provider-result, sibling cancellation, bounded repeated
  create/start/cancel/dispose lifecycle and browser mock parity.

## Validation

Run focused Rust/TypeScript tests first, then the current repository gates:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:check
npm run verify:rust
npm run verify:security
npm run test:governance
git diff --check
```

Use task-scoped ignored temporary roots on the F: worktree if fixtures are
needed. Remove all task-owned artifacts before closeout; do not delete shared
dependency caches. macOS 13+ Apple Silicon native/runtime evidence is
reported `UNVERIFIED` unless actually run on that platform.

## Definition of Done

- exact W3-00 baseline and clean isolated worktree are recorded;
- this taskbook exists and remains current;
- one production registry owner replaces per-start `Vec::new()` composition;
- host/source capability, strict wire, asset and progressive contracts are
  implemented and focused-tested;
- existing authority boundaries and permission separation remain unchanged;
- no rich provider, W3-02 UI or W4 native integration entered the diff;
- applicable local gates pass on the exact final head;
- task-owned temporary artifacts are cleaned;
- final diff is W3-01 coherent and a Draft PR is created without auto-merge;
- independent architecture/code/maintainability review remains pending.
