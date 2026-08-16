# W1-01 Review Checklist

Use this checklist during Codex implementation and reviewer closeout.

- [ ] `file_workspace` is exposed from Rust without adding any Tauri command.
- [ ] `NavigationTarget::Library` serializes `source`, never `pub_source`.
- [ ] Rust and TypeScript discriminants/field names match exactly.
- [ ] Managed refs reuse `fileId` / `scanRootId`; no new durable IDs are invented.
- [ ] Ephemeral refs remain session-scoped and are not persisted as restore authority.
- [ ] Restore locator/bookmark is non-authoritative and contains no old session/path ref tokens.
- [ ] `MaterializationState` remains entry/source scoped.
- [ ] `ContentReadEligibility` remains separate from materialization state and does not become a second eligibility engine.
- [ ] `ContentReadLeaseRef` is opaque, request/source-version bound, and has no raw filesystem path.
- [ ] No runtime path resolution, byte read, provider materialization or mutation behavior is added.
- [ ] No Query V3, watcher rewrite, schema, migration or dependency change.
- [ ] Focused Rust serialization tests cover all public wire shapes.
- [ ] Frontend contract test covers representative discriminated-union shapes.
- [ ] `cargo fmt` / focused Rust tests / available clippy are green.
- [ ] focused frontend test, governance test and `git diff --check` are green.
- [ ] PR remains W1-01-only; no W1-02+ behavior is pulled forward.
