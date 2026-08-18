# W2-01 — Pre-Code Audit Addendum

Status: binding addendum to `W2-01-WORKSPACE-SHELL-CODEX.md`

Reviewed baseline: `master@e859578cce1c502bff309788e1ae58629251071d`

This addendum records final issues found after the main Codex handoff was hardened. Codex must read both files before production changes. If this addendum conflicts with older W2-01 wording, this addendum wins for W2-01.

## A1 — App/window lifetime does not mean background-work lifetime

The File Library `WorkspaceSession` / `FileWorkspaceController` owner should survive temporary navigation to other top-level Zen views during the same app/window session so in-process history and history-owned Browse refs are not silently lost.

However, when File Library becomes inactive, **current-target disposable work must not continue merely because the owner is long-lived**.

On File Library route deactivation, suspend/cancel/release work that is safe and expected to be disposable, including where applicable:

- pending/published Browse enumeration work and pages that are not required as retained history authority;
- ephemeral change monitor work;
- visible thumbnail requests;
- Preview work owned by the File Library experience;
- other W1 current-target disposable work.

Preserve:

- `WorkspaceSession` chronology;
- `lastLibraryTarget` / `lastBrowseTarget`;
- history-owned Browse session/path refs required for safe in-process Back/Forward/mode return;
- live presentation history.

On File Library route reactivation, resume/restart only the work needed for the current target. Do not rely on leaked background tasks as state restoration.

If the existing `FileWorkspaceController` lacks a safe public frontend seam for route suspension, W2-01 may add the smallest responsibility-consistent **frontend-only** seam. Do not expose new Tauri/backend authority. The seam must reuse W1 cleanup ownership and remain distinct from full controller `dispose()`.

Required tests:

1. admitted Browse target + disposable work exists;
2. navigate to another top-level Zen view;
3. disposable work is cancelled/released while history/session remains live;
4. return to File Library preserves exact W1 chronology/history-owned refs;
5. final AppShell/window teardown fully disposes the controller and returns owned resources to steady state.

## A2 — Neutral migration target is internal only

If W2-01 uses the temporary Library target:

```ts
{ kind: "library", source: "custom", key: "legacy_library" }
```

`legacy_library` is an internal migration key. It must never be displayed to the user as target text, breadcrumb, accessibility label or analytics/product copy.

Until W2-03 maps truthful semantic Library targets, the W2-01 shell should use neutral localized user-facing identity such as `Library` / the existing localized File Library label, without claiming `All Files`, `Recent`, a tag, saved view or current-scan semantic it does not own.

## A3 — Visual freeze is structural, W2-01 still requires rendered review

PR #87 freezes hierarchy, dimensions, responsive ownership and interaction semantics, but its canonical references are specification/wireframe-level rather than pixel-perfect production screenshots.

Therefore Codex must not treat the text/ASCII reference matrix as permission to improvise final visual polish without review. W2-01 must provide exact-head rendered evidence at the widths required by the main taskbook. Product/UX review remains a merge gate.

## A4 — Review independence

PRs #86/#87/#88 were reviewed through the same repository identity and should not be cited as proof that W2-01 production code has already received an independent implementation review.

W2-01 requires a fresh **post-implementation** review of the actual code/rendered result before Ready/Merge. The implementation agent must not self-approve the production PR merely because the planning/design docs previously passed review.
