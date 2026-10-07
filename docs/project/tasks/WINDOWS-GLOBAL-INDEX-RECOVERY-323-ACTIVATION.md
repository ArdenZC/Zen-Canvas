# Windows Global Index Recovery Remediation — Activation

Last verified: 2026-10-07

Status: **OWNER REVIEW PENDING — MERGE ACTIVATES #323 IMPLEMENTATION ONLY**

Issue: [#323 — Windows Global Index recovery loses paused/rebuild state across service transport](https://github.com/ArdenZC/Zen-Canvas/issues/323)

Activation baseline:

`master@cfdde76db2e339f1572e889fa586170361e2d796`

Baseline tree:

`d9dbf3f65ccacf4ab0201fab59ed36eb7825b53b`

Baseline CI:

`37563539120 — SUCCESS`

Schema: **37**

Package: **0.1.40**

AI-only Product Migration issue #273 is **CLOSED / completed**. This is a separate post-migration correctness initiative.

---

## 1. Purpose

Repair the Windows Global Index recovery-state loss discovered during PM-03 native qualification.

The defect is not a PM-03 regression. The affected Global Index code is pre-existing and was byte-equivalent between the PM-03 activation baseline and the candidate that exposed the failure.

Observed native sequence:

1. fixed NTFS `C:\` was the only enabled source;
2. normal shutdown during indexing left durable:
   - `index_status = error`
   - `last_error = indexing paused`;
3. same-candidate restart attempted incremental recovery;
4. the saved USN cursor was outside readable journal history;
5. USN code correctly wrote `rebuild_required`;
6. provider error handling overwrote that state as `permission_required`;
7. coordinator therefore did not enter the intended admitted MFT rebuild path.

No user fixture mutation, Operation, Cleanup or Trash activity accompanied the defect.

The remediation must restore truthful typed recovery semantics without redesigning Global Index.

---

## 2. Root-cause contract

Two related state-loss paths are in scope.

### A. Paused state loses type across service IPC

Service-side indexing may terminate with:

`GlobalIndexError::Paused`

The service currently serializes the failed operation using a generic:

`error_code = "index_failed"`

and desktop:

`service_response_error()`

reconstructs failed service responses as generic:

`GlobalIndexError::Provider(message)`.

This loses the Paused variant.

Coordinator can then persist:

`error / indexing paused`

instead of truthful paused shutdown state.

### B. USN rebuild-required state is overwritten

`usn::sync_volume()` correctly persists:

`INDEX_STATUS_REBUILD_REQUIRED`

for:

- journal ID change;
- cursor outside available history;
- journal-history read failure;
- invalid/short/uncparseable USN data;
- non-continuous cursor.

But `DirectWindowsGlobalIndexProvider::resume_incremental_sync()` preserves rebuild state by matching error text containing:

`"rebuild required"`.

At least the cursor-outside-history path returns:

`"USN Journal cursor is no longer readable"`

which does not contain that phrase.

The generic branch then writes:

`INDEX_STATUS_PERMISSION_REQUIRED`.

The typed/durable rebuild classification is therefore lost.

---

## 3. Product truth after repair

Required state machine:

### Normal shutdown / cancellation

```text
active indexing/sync
→ cancellation / Pause
→ typed Paused
→ durable paused state
→ later startup may resume/re-evaluate normally
```

Do not persist a normal shutdown as:

`error / indexing paused`.

### USN history discontinuity

```text
incremental sync
→ detect journal ID/history/cursor discontinuity
→ durable rebuild_required
→ propagate typed rebuild-required outcome
→ coordinator next admitted cycle selects MFT rebuild
→ indexing
→ ready
```

Do not classify a proven USN history discontinuity as:

`permission_required`.

### Genuine permission/provider error

Only actual permission/provider failures may enter:

`permission_required`

according to the existing provider contract.

---

## 4. Preferred implementation boundary

Prefer typed/status-preserving transport.

The existing wire already contains:

`IndexServiceResponse.error_code`.

Use a bounded stable error-code mapping rather than parsing user-facing error messages.

At minimum the desktop must be able to distinguish:

- paused/cancelled operation;
- rebuild-required condition;
- genuine provider/permission failure.

Do not add arbitrary structured exception payloads.

Do not expose OS paths or sensitive indexing content in error codes.

Do not rely on:

`error.to_string().contains(...)`

for correctness-critical state transitions.

Message strings may remain diagnostic text only.

---

## 5. Protocol/version rule

Do not bump the named-pipe protocol merely for a semantics-preserving use of the existing `error_code` field.

Current protocol shape remains:

`IPC_PROTOCOL_VERSION = 3`

unless implementation proves a wire-incompatible shape change is genuinely required.

If a protocol bump or new frame shape appears necessary:

**STOP and return to Owner review.**

Do not silently create v4.

---

## 6. Service-side error mapping

Index-service responses for operation failure must encode a stable machine-readable classification.

A reasonable bounded mapping is conceptually:

- `index_paused`;
- `index_rebuild_required`;
- `index_permission_required` or bounded provider failure;
- fallback `index_failed`.

Exact names may follow repository conventions.

The mapping must derive from typed error / durable source state, not diagnostic message substring.

Service lifecycle status must remain truthful.

Normal Pause command behavior remains unchanged.

SCM remains the only service shutdown authority.

---

## 7. Desktop-side error reconstruction

`WindowsGlobalIndexProvider::service_response_error()` must reconstruct the appropriate semantic outcome from stable `error_code`.

Required examples:

```text
index_paused
→ GlobalIndexError::Paused
```

and a rebuild-required response must remain distinguishable from permission failure.

If the existing `GlobalIndexError` enum lacks a safe typed rebuild variant, implementation may add one narrow internal variant.

Do not use renderer-visible errors as authority.

Do not change public product APIs unnecessarily.

---

## 8. Rebuild-required preservation

Eliminate correctness dependence on diagnostic strings in:

`DirectWindowsGlobalIndexProvider::resume_incremental_sync()`.

USN helpers already know when they have durably classified a source as rebuild-required.

The provider must preserve that classification.

Acceptable designs include:

- a typed `GlobalIndexError::RebuildRequired` carrying bounded diagnostic text; or
- another narrow typed internal outcome that guarantees coordinator preservation.

Do not infer rebuild status by re-reading arbitrary text.

---

## 9. Coordinator behavior

Preserve the existing coordinator architecture and WorkScheduler / RuntimeResourceGovernor admission.

After a rebuild-required outcome:

- durable source remains `rebuild_required`;
- no generic error branch overwrites it to permission-required;
- next eligible coordinator cycle identifies:
  `is_rebuild = true`;
- existing admitted MFT rebuild path is used;
- no polling loop is added;
- no second coordinator/service is introduced.

Normal cancellation/shutdown remains non-error.

---

## 10. Source-state ownership

Preserve current authority:

- `global_volumes` is durable source/recovery truth;
- installed Windows Global Index service owns privileged MFT/USN enumeration;
- desktop coordinator owns scheduling/admission and durable reconciliation;
- named-pipe transport carries bounded metadata-index operations only.

Do not create a second durable recovery store.

Do not persist service-local shadow truth.

---

## 11. Filesystem safety

This remediation changes metadata indexing/recovery only.

It must create **zero user filesystem mutation authority**.

Do not modify:

- Operation Preview;
- Operation Journal;
- Safe Trash;
- Restore;
- Cleanup execution;
- Automation execution;
- Rule execution.

MFT/USN enumeration remains read-only metadata indexing.

---

## 12. Explicit non-goals

Do NOT absorb:

- PM-03 route/handoff work;
- issue #270 macOS tray/runtime compatibility;
- issue #283 Preference research;
- TD-001 File Library store retirement;
- TD-002 AppRuntimeProviders decomposition;
- TD-003 watcher fallback retirement;
- TD-005 organize-decision bridge retirement;
- TD-006 managed-AI legacy queue retirement;
- TD-007 design-token aliases;
- TD-008 broad Rust module splitting;
- TD-009 Windows platform refactor;
- TD-010 general Tauri contract generation;
- TD-012 asset cleanup;
- TD-015 File Library/Vault compatibility retirement;
- release publication.

Do not turn #323 into a Global Index architecture cleanup.

---

## 13. Schema/package freeze

Required:

Schema = **37**

Package = **0.1.40**

No database migration is expected.

No package bump is authorized.

If a durable schema change becomes necessary:

**STOP and return to Owner review.**

---

## 14. Deterministic tests — service transport

Add focused coverage proving at minimum:

### Paused mapping

Service-side typed:

`GlobalIndexError::Paused`

produces a stable paused error code/status.

Desktop reconstruction returns:

`GlobalIndexError::Paused`

not generic Provider.

### Unknown/fallback failure

Unknown service failure remains bounded generic failure.

Do not interpret arbitrary message text as Paused/Rebuild.

### Protocol compatibility

Existing v3 request/response validation remains intact.

No request authority expands.

---

## 15. Deterministic tests — USN rebuild classification

Add coverage for every USN path that must require rebuild:

1. journal ID changed;
2. cursor < FirstUsn;
3. cursor > NextUsn;
4. journal-history read error;
5. short USN continuation page;
6. parse failure;
7. non-continuous cursor;
8. directory rename reconciliation path where already owned by this contract.

Required:

- durable state becomes `rebuild_required`;
- returned outcome remains typed/preserved as rebuild-required;
- provider does not rewrite to `permission_required`.

Do not require real production-volume corruption for unit tests.

---

## 16. Coordinator recovery tests

Add deterministic end-to-end coordinator tests proving:

### Shutdown

Active operation receives cancellation:

- outcome Paused;
- durable state becomes paused;
- no error status;
- no false permission state.

### Rebuild

Starting from a source whose incremental sync reports rebuild-required:

- first cycle retains `rebuild_required`;
- next eligible cycle invokes rebuild/initial MFT path under existing Background admission;
- successful rebuild reaches ready;
- checkpoint/full-index fields update according to existing contract.

### Failure separation

A genuine permission/provider failure still reaches the appropriate degraded state.

Do not make every provider failure rebuild.

---

## 17. Windows service regression

Hosted Windows validation must exercise the installed/service transport path, not only force-direct provider tests.

Add or extend the existing Windows Global Index service qualification so exact-head CI proves:

- service operation Pause preserves paused semantics across pipe;
- rebuild-required survives pipe transport;
- desktop coordinator does not persist `error / indexing paused`;
- desktop coordinator does not convert a rebuild-required source to permission-required;
- next admitted rebuild path is selected.

No test may weaken service ownership/security checks.

---

## 18. Native Owner qualification

After implementation/CI review, perform one bounded Windows qualification on a fresh disposable host/profile.

Required native evidence:

### A. Pause/shutdown row

While initial/index work is genuinely active:

- normal app/background shutdown sequence requests pause;
- durable source must not become `error / indexing paused`;
- accepted state is paused or another truthful non-error shutdown state.

Restart same exact candidate/profile:

- source automatically re-enters normal evaluation without manual Rebuild.

### B. Rebuild-required row

Use a controlled isolated qualification database/profile to create a known stale USN cursor condition **before launch**.

This is qualification fixture setup, not product behavior.

Record the exact manual database mutation.

On startup:

- native provider detects cursor/history discontinuity;
- durable source becomes `rebuild_required`;
- coordinator automatically enters the admitted MFT rebuild path;
- no manual Rebuild/Resume action;
- source progresses to `indexing` and preferably `ready`.

Do not require a whole large volume to finish if state-machine transition and rebuild admission are unambiguous.

### C. Safety

Qualification fixture files remain unchanged.

Operation/Cleanup/Trash remain zero.

Internal index/database growth is expected and recorded separately.

---

## 19. Native qualification mutation rule

The only allowed manual qualification mutation is controlled seeding of the isolated Global Index recovery metadata needed to create a stale cursor condition.

Do not modify user files.

Do not modify a real-user profile.

Do not alter Windows USN journal configuration.

Do not delete/recreate the journal.

Do not use destructive volume commands.

---

## 20. Documentation

Implementation closeout must update:

- `docs/project/STATUS.md`;
- `docs/project/ROADMAP.md`;
- `docs/project/ARCHITECTURE_MAP.md` if transport/state ownership changes materially;
- this task result;
- issue #323 evidence record;
- `RISK_REGISTER.md` only if the project-level risk disposition changes.

Preserve AI-only Product Migration #273 as completed/closed historical authority.

Do not reopen #273.

---

## 21. Completion criteria

#323 may be Owner Review PASS only when:

1. Paused survives service transport as Paused.
2. Normal indexing cancellation/shutdown no longer persists `error / indexing paused`.
3. USN history discontinuity remains `rebuild_required`.
4. No message-substring matching controls rebuild correctness.
5. Coordinator automatically selects existing admitted MFT rebuild.
6. Permission-required remains reserved for genuine permission/provider failure.
7. Hosted Windows service regression passes.
8. Windows native pause/restart evidence passes.
9. Windows native stale-cursor/rebuild evidence passes.
10. user/qualification fixture automatic mutations = 0.
11. Schema remains 37.
12. package remains 0.1.40.
13. #270/#283/unrelated technical debt remain untouched.

---

## 22. Activation stop

This activation PR is documentation/governance only.

Do not implement production code before activation merge.

Merge of this activation authorizes only:

**Windows Global Index Recovery Remediation — issue #323**

Until activation merges:

**#323 implementation remains NOT ACTIVE.**
