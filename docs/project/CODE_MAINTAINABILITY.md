# Zen Canvas Code Maintainability Rules

Status: repository-wide engineering rule

Purpose: keep implementation understandable, reviewable and safe as Zen Canvas grows. These rules apply to production code and substantial test infrastructure in every initiative unless a narrower reviewed contract is stricter.

This document is not a style guide about arbitrary line counts. It defines **responsibility and ownership boundaries**. A long cohesive parser or generated table may be healthy; a shorter file that owns several independent lifecycles may already be unhealthy.

## 1. Core rule — one coherent responsibility boundary per module

A source module should have one primary reason to change.

Do not keep adding unrelated responsibilities to a file merely because the new code belongs to the same product feature.

Examples of responsibilities that normally deserve distinct modules once they become non-trivial:

- public/domain value types and wire contracts;
- orchestration/service lifecycle;
- scheduling/admission/backpressure;
- cache storage/eviction/atomic commit;
- persistence/database access;
- filesystem/native platform adapters;
- network/provider adapters;
- parsing/serialization;
- renderer/provider implementation;
- cancellation/owner/publication lifecycle;
- tests/fixtures when test volume obscures production behavior.

A feature name such as `thumbnail`, `preview`, `search` or `scanner` is **not** by itself a sufficient single responsibility.

## 2. Mandatory decomposition triggers

Before adding more behavior to an existing file, stop and consider decomposition when **any** of the following is true.

### 2.1 Multiple independent lifecycles or resource owners

The file owns two or more independently meaningful lifecycles, for example:

- request/session ownership **and** cache lifecycle;
- scheduler admission **and** worker/executor lifecycle;
- provider/native-process lifecycle **and** service state;
- DB transaction ownership **and** UI/event state;
- filesystem handles **and** durable queue/job ownership.

When these can block, cancel, fail, retry or clean up independently, they should usually have explicit module boundaries.

### 2.2 Multiple infrastructure concerns

The same file directly implements several of:

- scheduling;
- disk I/O/cache eviction;
- native platform integration;
- persistence;
- network/provider access;
- synchronization/locking;
- public API/domain contracts.

Move the implementation detail behind a narrow interface instead of growing one orchestration file indefinitely.

### 2.3 Global coordination locks cover slow/external work

If a coordination mutex/lock is held while doing filesystem I/O, `fsync`, network/provider calls, subprocess/native-helper work, database work or other potentially slow operations, treat that as a design smell requiring review.

Prefer:

```text
lock -> snapshot/claim state -> unlock
     -> slow work
lock -> validate publication/commit ownership -> short state update -> unlock
```

Do not serialize an entire subsystem merely because one large file makes that implementation convenient.

### 2.4 Tests hide the production design

When an in-file `#[cfg(test)]` / test block becomes large enough that reviewers must scroll through substantial fixture/test code to understand production responsibilities, move tests into behavior-oriented test modules/files.

Prefer grouping tests by contract such as:

- lifecycle/cancellation;
- scheduling/backpressure;
- cache identity/eviction;
- read/materialization boundary;
- platform adapter;
- stale-publication behavior.

Do not split tests mechanically into one file per function.

### 2.5 Platform code dominates generic code

Cross-platform service code must not become a container for large macOS/Windows implementations.

Shared code should define the contract/orchestration. Native behavior belongs under existing platform/domain adapter boundaries where possible.

Do not create fake cross-platform symmetry by moving native implementation into a generic module.

### 2.6 Reviewability degrades

Refactor before further expansion when reviewers can no longer answer these questions quickly:

- Who owns this state?
- Who is allowed to mutate it?
- Where is cancellation checked?
- Which component owns scheduling/backpressure?
- Which component owns disk/network/native I/O?
- Where does cache/persistence identity come from?
- Which authority is being reused rather than duplicated?
- What is the cleanup boundary?

If the answers require understanding most of a multi-thousand-line file, the module boundary is too broad.

## 3. File size is a signal, not an automatic rule

Zen Canvas does **not** impose a universal “N lines maximum” rule.

However, file size is a review signal:

- around **500–800 lines of hand-written production logic**: reviewers should actively check whether responsibilities are still cohesive;
- around **1000+ lines of hand-written production logic**: the PR should normally explain why the file remains one coherent unit or decompose it;
- around **1500+ lines**: adding another independent responsibility without decomposition is presumed unacceptable unless the content is generated/data-heavy or a reviewer records a specific reason.

These numbers are heuristics, not permission to create meaningless micro-files or to evade the rule by compressing code.

Tests, generated code, schemas and data tables may legitimately exceed these signals when the responsibility remains coherent.

## 4. Prefer subsystem directories over mega-files

When a domain becomes substantial, prefer a module directory with a small stable entry point.

Example shape:

```text
feature/
├── mod.rs          # stable exports / module wiring
├── types.rs        # domain values/contracts
├── service.rs      # orchestration/lifecycle
├── cache.rs        # cache ownership, if applicable
├── read.rs         # read-authority adapter, if applicable
├── renderer.rs     # provider/renderer contract, if applicable
└── tests/          # behavior-oriented tests when substantial
```

This is an example, not a required template. Use fewer files when the subsystem is smaller.

Avoid the opposite failure mode: dozens of tiny files that each contain one trivial function and make control flow harder to follow.

## 5. Orchestration files should express the flow, not every mechanism

A service/orchestration module should make the lifecycle readable at a high level.

Good shape:

```text
validate request
-> resolve authority
-> check cache
-> deduplicate/attach owner
-> acquire scheduler/resource authority
-> perform bounded work through adapter
-> revalidate cancellation/source/publication
-> commit result through cache/storage boundary
-> publish result
```

The orchestration module should not also contain the full implementation of atomic disk writes, cache-directory scans, native subprocess handling, provider protocol parsing and all test fixtures.

## 6. Preserve authority boundaries while refactoring

Module decomposition must **not** create duplicate authorities.

Refactoring a mega-file is not permission to introduce:

- a second scheduler;
- a second query/index;
- a second read/materialization policy;
- a second mutation/recovery path;
- a second watcher truth source;
- a second durable job or persistence system.

Split implementation ownership behind existing authorities.

## 7. Refactor at the right time

Prefer decomposition:

- while a feature PR is still Draft and before many callers depend on the internal shape;
- when fixing a bug that exposes confused responsibility/locking/lifecycle boundaries;
- before adding another major capability to an already overloaded module.

Do **not** combine an unrelated repository-wide cleanup with a focused bug fix merely because a file is large. Refactoring should be bounded to the responsibility boundaries needed for the active change.

A review may classify decomposition as merge-blocking when the current structure directly contributes to correctness, concurrency, ownership or testability risk.

## 8. PR and review requirements

For a substantial new subsystem or a PR that materially expands an existing module:

1. identify the primary module responsibilities in the PR/taskbook;
2. call out new lifecycle/resource owners explicitly;
3. check whether the change triggers any decomposition rule above;
4. explain any intentional large-file exception;
5. keep public/stable exports narrower than internal implementation structure;
6. ensure tests are organized by behavior/contract when they become substantial.

Reviewers should not approve a mega-file solely because tests and CI are green. Maintainability, authority clarity, lock/resource ownership and future reviewability are part of correctness.

## 9. Codex / agent rule

Agents must not default to “append everything to the existing feature file”.

Before implementing a substantial feature, inspect the existing module responsibilities. If the requested change would give one file another independent lifecycle/infrastructure responsibility, propose or perform a bounded decomposition as part of the same Track when that decomposition is necessary to keep the design clear.

Do not perform speculative architecture rewrites. The target is **clear responsibility boundaries with the smallest coherent diff**.

At completion, report any file that remains unusually large and explain why it is still cohesive or what follow-up decomposition is explicitly deferred.

## 10. Current motivating example

W1-08 exposed this rule clearly: a single `thumbnail.rs` grew to contain domain contracts, service orchestration, local execution, WorkScheduler admission, cache implementation, deduplication/owner lifecycle, W1-07 read adaptation, native rendering adaptation and extensive tests.

The problem is not its line count alone. The correctness review found scheduling, cancellation/cache-publication and native-timeout boundaries that were harder to reason about because independent responsibilities were concentrated together.

Future implementation should prevent this pattern earlier rather than waiting until a file becomes a multi-thousand-line subsystem.