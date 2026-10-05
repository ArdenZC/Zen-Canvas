# AI-only PM-03 — Product Hierarchy / Migration Closeout Activation

Last verified: 2026-10-05

Status: **OWNER REVIEW PASSED / ACTIVATED — PR #320 MERGED; PM-03 IMPLEMENTATION ACTIVE**

Initiative: AI-only Product Migration / issue #273

Activation baseline: `master@1bafed6a64b6d6ff761af6ed70329d313143ed9d`

Baseline tree: `9c1427baedb83064a21f1fd829f8e1d813018ad0`

Baseline CI: `37267475464 — SUCCESS`

Schema: **37**

Package: **0.1.40**

---

## 1. Purpose

PM-03 is the final bounded product-migration closeout for issue #273.

PM-01 already established AI-required semantic truth for new/refreshed Organize and new executable Cleanup work.

PM-02A/PM-02B already established durable Automation Intent / Trigger / Policy / Run behavior, with Automation Intents as the primary Automation product surface and Rule Repository V2 retained as an advanced compatibility authority.

PM-03 does **not** add another intelligence or automation capability.

Its purpose is to close the remaining product-hierarchy and compatibility migration so ordinary product navigation no longer carries the old rule-centric identity as the canonical Automation route.

The final user model must be:

```text
Automation
→ Intents are the primary surface
→ Manual / Schedule / Managed-scope-change prepare reviewable Organize Plans
→ Advanced Policies / Compatibility exposes legacy Rule Repository V2 when explicitly requested
```

Rules remain a real advanced capability.

Rules are not current Organize semantic authority and are not the Automation product identity.

---

## 2. Starting truth

The current product has already completed most of the migration.

### Already correct — preserve

- Main sidebar does not expose Rules as a persistent peer.
- Automation opens `AutomationWorkspace`.
- Automation defaults to **Intents**.
- Existing Rule UI is nested behind **Advanced Rules**.
- Rule Repository V2 remains backend-authoritative for Rule mutation.
- Existing Rule Proposal review remains a real compatibility/policy workflow.
- watcher-driven Rule evaluation remains Rule behavior.
- PM-02B Automation remains review-required and never auto-executes filesystem mutations.
- Onboarding already explains AI provider selection, managed scope, separate Cleanup sharing, and Files/Search/Preview → Organize/Cleanup → History/Restore.
- No current Organize semantic fallback to Rules is authorized.
- Schema 37 is the current production schema.

### Remaining migration seams

The canonical product hierarchy still carries historical rule-centric identifiers:

- `View` still uses `"rules"` as the canonical route ID for the Automation workspace.
- `AppShell` maps `view === "rules"` to `AutomationWorkspace`.
- Spotlight command **Automation** routes internally to `"rules"`.
- Settings → Automation uses `setView("rules")`.
- Search-window navigation accepts `"rules"` as a current valid view.
- `?view=rules` is currently a canonical direct route rather than a compatibility alias.
- Some ordinary product actions/copy still say Rule Engine / Rule Library where the product-level destination is Automation.
- Rule-specific terminology remains valid only inside the explicit advanced compatibility surface.

These seams are migration debt, not evidence that Rules are the product authority.

---

## 3. PM-03 activation scope

PM-03 may implement exactly the following bounded closeout.

### A. Canonical Automation route identity

Introduce `automation` as the canonical product view identity.

After migration:

```text
canonical View = "automation"
legacy accepted input alias = "rules"
```

Requirements:

- normal product code writes/navigates to `automation`;
- Main shell renders `AutomationWorkspace` for `automation`;
- Spotlight Automation command targets `automation`;
- Settings Automation entry targets `automation`;
- current product-level history/navigation actions target `automation`;
- new tests and fixtures use `automation`, not `rules`.

The legacy literal `rules` may remain only in an explicit compatibility-normalization seam.

Do not retain two equal canonical views.

### B. Legacy route compatibility

Existing deep links or search-navigation payloads using `rules` must fail safe and remain usable during migration.

PM-03 may add a narrow normalization function such as:

```text
legacy "rules" input
→ canonical "automation"
```

Compatibility rules:

- `?view=rules` opens the canonical Automation workspace;
- Search Window / cross-window navigation carrying historical `view="rules"` normalizes to Automation;
- normalized application state stores/returns only canonical `automation`;
- invalid view inputs continue to fail closed to the existing safe default;
- no backend command, schema or durable Rule data migration is required.

Do not introduce a generic redirect framework.

### C. Product hierarchy / copy closeout

Ordinary product surfaces must speak in the current hierarchy.

Canonical ordinary terms:

- Automation
- Intents
- Prepare / Generate Plan
- Review required
- Advanced Policies / Compatibility

Rule-specific terms are allowed only inside the advanced surface where the user is actually inspecting or editing Rule Repository V2.

At minimum audit:

- Main title/context;
- Spotlight command;
- Settings Automation section;
- History/Preview secondary actions;
- empty states;
- bilingual i18n;
- accessibility labels;
- browser evidence scripts.

Do not globally rename backend/domain Rule types.

### D. Advanced Rule surface

Keep existing Rule Repository V2 and Rule Proposal behavior intact.

The advanced surface must be clearly subordinate to Intents.

It may be labelled **Advanced Policies**, **Policies & Compatibility**, or equivalent product wording, provided:

- the surface truthfully says it manages existing deterministic rules/compatibility classification;
- it does not claim to generate current Managed AI Organize semantics;
- it does not imply file-operation authority;
- Rule Library terminology, if retained, appears only inside this advanced surface;
- switching back to Intents is obvious and keyboard-accessible.

PM-03 must not reinterpret existing Rules as Automation Intents.

PM-03 must not silently migrate Rules into broader permissions.

### E. Settings and onboarding audit

Settings Automation must route to the canonical Automation workspace.

Onboarding is already AI-first and must not be redesigned merely because PM-03 exists.

Only change onboarding when a direct current-master audit finds stale rule-centric or false compatibility copy.

Preserve:

- explicit AI skip;
- useful-folder requirement;
- separate Managed Scope local/cloud consent;
- separate Cleanup sharing/configuration;
- truthful capability sequence.

### F. Migration evidence and closeout

PM-03 must provide migration evidence proving:

- ordinary product routes use Automation canonically;
- old `rules` links still land safely on Automation;
- Intents remain the default surface;
- Advanced Policies/Compatibility remains reachable;
- existing Rule Repository behavior still works;
- no filesystem mutation is introduced;
- no semantic authority changes;
- no Schema change.

---

## 4. Explicit non-goals

PM-03 is **not** a general compatibility-debt cleanup initiative.

Do not include unrelated technical debt solely because it contains the word legacy or compatibility.

Out of scope:

- TD-001 `useFileLibraryStore` retirement;
- TD-003 watcher renderer fallback retirement;
- TD-004 unused Operation Preview helper cleanup;
- TD-005 `useOrganizeDecisionStore` bridge retirement;
- TD-006 `global_index/legacy_queue.rs` retirement;
- TD-007 design-token alias retirement;
- TD-008 module splitting;
- TD-009 Windows platform refactor;
- TD-010 Tauri contract generation;
- TD-012 package asset cleanup;
- TD-015 File Library / Vault compatibility retirement;
- broad `LEGACY_RETIREMENT_PLAN.md` execution.

Those retain their own exit conditions and review gates.

Also out of scope:

- deleting Rule Repository V2 tables/schema/commands;
- changing Rule AST semantics;
- changing Rule Proposal generation/validation authority;
- removing watcher Rule evaluation;
- automatic Rule-to-Intent conversion;
- Cleanup automation;
- Organization Plan automatic execution;
- autonomous filesystem mutation;
- new trigger kinds;
- arbitrary cron/webhook/email/network/calendar triggers;
- new scheduler/daemon/service;
- new AI queue/provider/runtime;
- Preference Memory production;
- System One / Laya / Jev;
- RAG/vector storage;
- general agents/tools/shell/MCP execution;
- release publication;
- package/version bump;
- Schema 38.

Schema must remain **37**.

Package must remain **0.1.40**.

---

## 5. Authority boundaries

### 5.1 Automation authority

Automation Intent V1/V2 and Automation Run remain the durable Automation product authority introduced by PM-02.

PM-03 changes presentation/navigation identity only.

It must not change:

- Intent persistence;
- trigger semantics;
- Schedule calendar;
- managed-scope-change publication;
- review-pending suppression;
- Run request keys;
- WorkScheduler / RuntimeResourceGovernor admission;
- Managed AI enqueue/currentness;
- Organization Plan materialization.

### 5.2 Rule authority

Rule Repository V2 remains the only Rule mutation authority.

Rule Proposal remains the reviewed proposal path.

Existing Rule execution remains deterministic Rule behavior and must not be relabelled as current Managed AI semantic analysis.

### 5.3 Semantic authority

Current Managed AI assessment remains new/refreshed Organize semantic authority.

Cleanup remains governed by the accepted Cleanup AI + deterministic safety contract.

PM-03 must not restore `files` classification, Rule matches or learned Rules as semantic fallback.

### 5.4 Filesystem authority

PM-03 creates no new filesystem mutation path.

Preview, explicit confirmation, identity revalidation, journal, Safe Trash and Restore authorities remain unchanged.

---

## 6. Recommended implementation shape

Expected frontend changes are narrow and may include:

- `src/types/ui.ts`;
- `src/store/useAppStore.ts`;
- `src/components/AppShell.tsx`;
- `src/components/spotlight/commandRegistry.ts`;
- `src/utils/searchNavigation.ts`;
- `src/views/settings/SettingsView.tsx`;
- `src/views/settings/sections/AutomationSettingsSection.tsx`;
- `src/views/automation/AutomationWorkspace.tsx`;
- directly related ordinary-navigation callers such as Timeline/History;
- `src/i18n/dictionary.ts`;
- focused tests/evidence scripts.

Backend changes are not expected.

If implementation requires a database migration, Tauri command change, Rule Repository rewrite, watcher ownership change or Automation runtime change:

**STOP and return to Owner review.**

---

## 7. Route migration contract

The implementation must define one tested canonicalization boundary.

Example contract:

```ts
type View = ... | "automation" | ...

normalizeViewInput("automation") === "automation"
normalizeViewInput("rules") === "automation" // compatibility only
```

Requirements:

- application internal state uses canonical `automation`;
- current command catalog emits canonical `automation`;
- compatibility parsers may accept `rules`;
- direct legacy URL/query navigation remains functional;
- cross-window legacy navigation remains functional;
- malformed values remain rejected;
- no compatibility alias may accidentally select Advanced Rules by default.

A legacy `rules` deep link must open Automation with **Intents as the default surface** unless the request comes through a separately explicit advanced-policy action defined and tested in this Track.

---

## 8. Advanced surface contract

The canonical Automation workspace has two conceptual levels:

1. **Intents** — default / product-level;
2. **Advanced Policies / Compatibility** — explicit secondary surface.

The advanced surface may continue to render the existing `RulesView`.

PM-03 may change wrapper/navigation copy around `RulesView`, but must preserve the Rule Repository/Proposal behavior and validation contracts.

The implementation must prove:

- entering Automation normally shows Intents;
- opening the advanced surface requires explicit user action;
- returning to Intents is explicit;
- ordinary Settings/Spotlight entry never opens Rules by default;
- legacy `rules` compatibility input never opens Rules by default;
- Rule edit/create/proposal semantics remain unchanged.

---

## 9. Product-copy rules

Allowed ordinary-product wording should describe what Zen does now.

Do not claim:

- Rules are the Automation semantic engine;
- Rules are how Zen understands Organize;
- Automation automatically changes files;
- AI-off falls back to equivalent local Rule semantics;
- Preference Memory is active.

Advanced-surface wording may truthfully describe:

- deterministic rule conditions/actions;
- compatibility classification;
- Rule Proposal review;
- enable/pause lifecycle;
- manual Rule execution behavior.

All English/Chinese copy must stay aligned.

---

## 10. Deterministic test requirements

At minimum add/strengthen tests for:

### View normalization

- canonical `automation` accepted;
- legacy `rules` normalizes to `automation`;
- invalid route falls back safely;
- normal setView callers use `automation`.

### Search navigation

- current Automation payload uses `automation`;
- legacy cross-window `rules` payload normalizes to `automation`;
- nonce/session/revision guards remain unchanged;
- settings-target logic is unaffected.

### Spotlight

- Automation command emits `view="automation"`;
- legacy keyword `rules` may still discover Automation for compatibility;
- executing the command opens canonical Automation.

### Settings

- Automation Settings action opens canonical Automation;
- no ordinary Settings action opens Advanced Policies directly unless explicitly labelled as such.

### Automation workspace

- Intents default;
- advanced surface requires explicit action;
- advanced surface still renders Rule UI;
- focus/keyboard return between levels works.

### Historical navigation callers

- any prior Rule Engine / rules destination is either migrated to Automation or explicitly advanced;
- no ordinary caller writes `view="rules"`.

Repository-wide production search must prove `"rules"` remains only in:

- compatibility input tests/parsers;
- actual Rule domain/UI code;
- historical docs/evidence;
- search keywords where compatibility discovery is intentional.

It must not remain the canonical `View` identity.

---

## 11. Browser product evidence

Capture real mounted/browser product evidence in both English and Chinese.

Required scenarios:

1. Spotlight → Automation → Intents default.
2. Settings → Automation → canonical Automation workspace.
3. Automation → Advanced Policies/Compatibility → existing Rule Library behavior.
4. Advanced → Intents return.
5. legacy `?view=rules` → canonical Automation → Intents default.
6. narrow layout around approximately 760–900 px without blocking overflow.
7. keyboard focus restoration for the advanced/intents switch.
8. no file operation triggered by navigation or Rule inspection.

Do not treat screenshots alone as functional proof.

Use mounted assertions plus screenshots where useful.

---

## 12. Native Windows evidence

PM-03 is a product-hierarchy migration, so one bounded Windows native pass is required before Owner closeout.

Use an isolated profile and disposable test state.

At minimum prove on the exact candidate binary:

- app starts normally;
- Spotlight Automation opens the canonical Automation workspace;
- Intents are the default surface;
- Settings Automation opens the same canonical workspace;
- Advanced Policies/Compatibility can be opened explicitly;
- returning to Intents works;
- no unexpected Rule mutation occurs from navigation;
- no filesystem mutation occurs;
- existing durable Automation Intents remain readable;
- existing Rules remain readable under the advanced surface;
- restart does not turn the advanced compatibility surface into the default Automation state.

Do not require destructive Rule creation/editing solely for qualification.

If existing isolated fixtures safely support create/edit/disable without execution, that may be exercised, but it is not required to prove route migration.

---

## 13. Validation gates

Implementation candidate must pass at least:

- TypeScript typecheck;
- focused frontend unit/mounted tests;
- full relevant Vitest suite;
- production frontend build;
- docs/governance tests;
- `git diff --check`;
- repository architecture/performance routing required by changed paths;
- Windows/macOS supported CI lanes selected by repository routing.

No test may be weakened to hide a route compatibility failure.

No baseline threshold may be silently changed.

---

## 14. Documentation

Implementation closeout must update current truth where materially changed:

- `docs/project/STATUS.md`;
- `docs/project/ROADMAP.md`;
- `docs/project/ARCHITECTURE_MAP.md`;
- `docs/project/initiatives/ai-only-product-migration.md`;
- PM-03 result document;
- any command/navigation contract documentation directly affected.

Do not rewrite historical V4/W6/PM evidence merely because old terminology is historical.

Historical documents remain historical.

---

## 15. PM-03 completion criteria

PM-03 may be marked Owner Review PASS only when all are true:

1. `automation` is the canonical product view identity.
2. legacy `rules` navigation is compatibility input only.
3. ordinary entry points open Intents by default.
4. Rule Repository V2 remains accessible only through an explicit advanced compatibility/policy surface.
5. no ordinary product copy presents Rules as current semantic authority.
6. Onboarding/Settings remain truthful.
7. existing Rule behavior and Rule Proposal behavior are preserved.
8. PM-02 Automation behavior is unchanged.
9. Schema remains 37.
10. package remains 0.1.40.
11. browser evidence passes.
12. Windows native migration evidence passes.
13. automatic filesystem mutation count remains zero for the qualification flow.
14. no unrelated technical-debt retirement is bundled.

---

## 16. Initiative closeout rule

PM-03 is the final planned implementation stage of issue #273.

PM-03 merge does **not** automatically authorize:

- Preference Memory production;
- System One/Laya/Jev;
- Cleanup automation;
- autonomous mutation;
- release publication.

After PM-03 implementation merges and merge-after master CI succeeds:

- perform a docs-only AI-only Product Migration reconciliation;
- verify PM-01, PM-02A, PM-02B and PM-03 are all COMPLETE / MERGED;
- preserve accepted UNVERIFIED PM-02B evidence limits;
- if no migration blocker remains, issue #273 becomes eligible for Owner closure.

Research issue #283 remains separate and does not become production authority.

---

## 17. Stop conditions

STOP and return to Owner review if implementation discovers that correct migration requires:

- Schema 38;
- changing Rule Repository durable semantics;
- deleting legacy Rule data;
- changing watcher Rule execution;
- changing Automation trigger/runtime semantics;
- changing Organization/Cleanup semantic authority;
- changing filesystem execution authority;
- migrating unrelated File Library/Vault compatibility debt;
- new AI/runtime infrastructure;
- package/release work.

Do not expand PM-03 to absorb these concerns.

---

## 18. Activation disposition

Merge of this activation authorizes only:

**PM-03 — Product Hierarchy / Migration Closeout**

Implementation must start from the exact post-activation master.

No implementation commit belongs in this activation PR.

Activation closeout: PR #320 squash-merged as `master@c059d911eb053753d7ce7693aa30e39e3965f88c` / tree `771cdfcc5eb7e79fc33415df1a6275f366516ca2`; merge-after CI 37270388844 is **SUCCESS**.

**PM-03 implementation is ACTIVE.**
