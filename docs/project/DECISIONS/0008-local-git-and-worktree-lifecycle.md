# ADR-0008: Local Git and Worktree Lifecycle

Status: accepted

Date: 2026-09-02

## Context

Zen Canvas already has baseline and worktree safety, branch-per-initiative guidance, squash content-equivalence cleanup, branch closeout and local task-artifact cleanup.

ES-00 and subsequent repository-health work found a remaining lifecycle gap: the common checkout had no explicit long-lived role; historical linked worktrees could accumulate without explicit disposition; remote-upstream disappearance did not imply local work was disposable; dirty, untracked or evidence ownership could outlive task closeout; and Git ref/object integrity failures could become mixed with ordinary cleanup.

The problem is not too many worktrees by itself. The problem is missing ownership, disposition and recovery semantics.

## Decision

### 1. Common checkout role

The common/main checkout is the preferred stable repository entrypoint and normally returns to `master + clean` outside explicitly owned bounded work.

This is not a rule that it may never temporarily host another branch. Unknown or stale main-working-tree state blocks using that checkout as a new task baseline or destructively cleaning it without proof.

It does not automatically block unrelated healthy linked-worktree activity unless shared Git repository integrity is affected.

### 2. Bounded linked-worktree purpose

Task worktrees are bounded execution environments. At creation or first use, their path, branch/HEAD, base and task/PR purpose must be known.

Do not create a permanent repository worktree database or registry.

### 3. Explicit closeout disposition

A task-owned worktree must not become forgotten long-lived state. After the owning task is merged, superseded or abandoned, it should be retired, intentionally retained for a current purpose, or retained because of an exact recorded cleanup blocker.

Physical deletion is not universally required for task closeout when truthful retention or blocker evidence exists.

### 4. Preservation before destructive cleanup

Before worktree removal, prove topology and identity, preservation of committed work, classification of non-committed local state, and evidence disposition.

A branch ref preserves committed work only. Ignored status is not proof of disposability. Unknown local content blocks destructive cleanup.

### 5. Branch and worktree lifecycle are separate

Reuse existing ancestor/content-equivalence rules for branch absorption. Do not use ahead, `[gone]`, age or count as deletion authority. Branch deletion and worktree removal require separate conclusions.

### 6. Repository recovery precedes cleanup

Common ref, object or fetch integrity failure is repository recovery, not ordinary stale-worktree cleanup. Prefer restoring trustworthy Git integrity before simplifying topology.

Do not delete arbitrary refs merely to get past corruption.

### 7. No automatic local-hygiene gate

Do not create a worktree TTL, maximum count, scheduled clean or prune, automatic local branch or worktree deletion, or hosted CI failure based on developer-local worktree inventory.

Natural review points are task or PR closeout, initiative closeout and repository-health incidents.

## Relationship to ADR-0007

ADR-0008 applies ADR-0007 proportional failure handling to local Git state.

Unknown local content creates credible data-loss risk, therefore destructive cleanup fails closed at that worktree. This does not automatically block unrelated healthy work. Shared object or ref corruption has broader scope because multiple worktrees rely on the common repository.

ADR-0008 does not replace ADR-0007.

## Consequences

Positive consequences:

- the main repository entrypoint remains recoverable;
- completed task worktrees stop accumulating by default;
- local evidence is less likely to be destroyed;
- squash-merge branch equivalence remains reusable;
- Git corruption is treated separately from housekeeping;
- no recurring cleanup bureaucracy or CI cost is introduced.

Costs and tradeoffs:

- worktree closeout requires a small preservation or disposition decision;
- some worktrees may intentionally remain when evidence or blockers exist;
- cleanup is not fully automatable;
- repository recovery may be slower than simply deleting suspicious refs, but is safer.

## Rejected alternatives

### Maximum worktree count or TTL

Rejected because age or count does not prove ownership or disposability.

### Delete all `[gone]` upstream branches/worktrees

Rejected because remote disappearance does not prove local committed or uncommitted work is preserved.

### Keep every dirty worktree forever

Rejected because dirty state requires disposition, not permanent retention.

### Force-remove after preserving branch ref

Rejected because a ref preserves committed history only, not non-committed local state.

### Automatic CI/prune/deletion

Rejected because worktrees are developer-local execution state and hosted CI is not their authority.

### Treat main checkout as permanently master-only

Rejected because bounded explicit use can be legitimate; the durable requirement is stable and recoverable disposition, not an absolute branch prohibition.

## Scope and non-goals

ADR-0008 creates no Worktree Registry, TTL system, cleanup bot, CI gate, branch-state enum or local-state database. It does not itself delete any existing branch or worktree.

Existing worktree inventory and retirement is a separate housekeeping operation after this governance decision merges.
