# Managed AI SemanticAssessmentV1 Canonical Enum Contract

Contract source commit: `4f53d61fe1a47f62630a56278a39b27a49f52d4e`.

The candidate prompt lists the canonical outputs below. The values come from the production `SemanticAssessmentV1` parser and persisted domain enums, and the candidate contract test reads those same production definitions so drift fails before a provider run.

| Field | Canonical output values | Production source |
|---|---|---|
| `fileType` | `Document`, `Image`, `Video`, `Audio`, `Code`, `ArchivePackage`, `Installer`, `Spreadsheet`, `Presentation`, `Other` | `src-tauri/src/ai/semantic.rs`: `FILE_TYPES`, `canonical_file_type` |
| `purpose` | `Project`, `Teaching`, `Study`, `Work`, `Personal`, `Career`, `Finance`, `Identity`, `Media`, `Installer`, `Temporary`, `Archive`, `Document`, `Duplicate Review`, `Unknown` | `src-tauri/src/db/types.rs`: `Purpose`; `src-tauri/src/ai/semantic.rs`: `canonical_purpose` |
| `lifecycle` | `Inbox`, `Active`, `Reference`, `Archive`, `Disposable`, `Duplicate`, `Sensitive`, `TrashReview`, `Unknown` | `src-tauri/src/db/types.rs`: `Lifecycle`; `src-tauri/src/ai/semantic.rs`: `canonical_lifecycle` |
| `riskLevel` | `Normal`, `Sensitive`, `System`, `Caution`, `Unknown` | `src-tauri/src/db/types.rs`: `RiskLevel`; `src-tauri/src/ai/semantic.rs`: `canonical_risk` |
| `suggestedAction` | `Keep`, `Rename`, `Move`, `MoveAndRename`, `Archive`, `Review`, `DeleteCandidate`, `Unknown` | `src-tauri/src/db/types.rs`: `SuggestedAction`; `src-tauri/src/ai/semantic.rs`: `canonical_action` |

## Parser behavior relevant to the experiment

- `fileType` must normalize to one of the ten parser `FILE_TYPES`; otherwise parsing fails with `managed_ai_invalid_file_type`. Normalization ignores ASCII punctuation and case. The prompt asks for the exact displayed spelling and capitalization.
- Purpose and lifecycle map unrecognized values to `Unknown`. Risk maps `low` to `Normal` and `medium`, `high`, or `caution` to `Caution`; unrecognized values map to `Unknown`. Suggested action maps `delete` to `DeleteCandidate`, while unrecognized values conservatively map to `Review`. These are parser compatibility behaviors; the candidate prompt does not add aliases.
- V1 requires `version`, exact `refId`, `fileType`, `purpose`, `lifecycle`, `context`, `riskLevel`, `suggestedAction`, `confidence`, `reason`, and `requiresConfirmation`. `targetTemplate`, `suggestedName`, and `keywords` are optional. Unknown object fields are rejected.
- `targetTemplate` is a relative `/`-separated folder hint. Production rejects an empty or over-512-byte value, absolute paths, backslashes, colons, control characters, empty / `.` / `..` segments, segments over 120 characters, Windows-invalid filename characters, trailing period / space, and reserved Windows device names. An unsafe value is dropped and forces `Review`.
- `suggestedName` is limited to 255 characters and passes the existing filename-shape validator. For files, the indexed extension must be preserved; an omitted extension is restored using the original spelling. An unsafe name is dropped and forces `Review`.
- The production request remains metadata-only and has no filesystem authority. The candidate inherits the baseline request metadata builder and response parser; this experiment changes only the system prompt text.

## Source anchors

- Managed AI production prompt: `src-tauri/src/global_index/managed_worker_hardened.rs`, `build_managed_ai_request`.
- SemanticAssessmentV1 shape, canonicalization, and target safety: `src-tauri/src/ai/semantic.rs`.
- Persisted domain enum values: `src-tauri/src/db/types.rs`.
- Filename extension-preservation rules: `src-tauri/src/file_naming.rs`, `normalize_proposed_file_name`.
