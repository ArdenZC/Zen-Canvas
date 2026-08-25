# Zen Canvas Product Map

Zen Canvas is a local-first personal file lifecycle assistant. It does not replace Finder or File Explorer as the operating system's canonical filesystem browser. It adds managed indexing, review, content preview, safe execution and recovery around user files.

This map describes product ownership. Durable implementation authority is defined in `ARCHITECTURE_MAP.md`. Current initiative/Track state remains owned by `STATUS.md`.

## Primary navigation workspaces

| Workspace | User purpose | Product boundary |
| --- | --- | --- |
| Overview | See coverage, health and work that needs attention | Summary/projection only; it does not invent counts or lifecycle truth |
| File Library | Browse and inspect managed files, filters, tags, saved views and selection | Managed-file workspace; the completed File Library 2.0 experience preserves Query V2 authority |
| Organize Files | Review organization proposals and decide what may proceed | Durable Organization Plan review; not a second filesystem executor |
| Storage Cleanup | Analyze storage findings and move confirmed findings through the safe cleanup path | Durable Analysis findings plus Safe Trash; no renderer-owned cleanup truth |
| History | Understand changes, restore recoverable work and resolve recovery cases | Operation/cleanup ledgers and identity revalidation |

## Advanced navigation workspaces

| Workspace | User purpose | Product boundary |
| --- | --- | --- |
| Automation | Browse, create, review, enable and run rules | Rule Repository V2 plus durable Rule Proposal; Apply, Enable and Run remain separate |
| Settings | Configure app, search, indexing, AI/provider, lifecycle and diagnostics | Persisted settings/provider contracts; technical detail remains secondary to task language |

## Cross-cutting and contextual surfaces

| Surface | User purpose | Product boundary |
| --- | --- | --- |
| Global Search | Find files and commands across configured global index sources | Cross-cutting global metadata search; separate from managed File Library search and Content Search |
| Zen Content Quick Preview | Inspect the current file/folder without entering a mutation workflow | Existing `ZenFloating` / `ZenPinned` content-preview experience over PreviewSession, Provider Registry, sourceVersion and bounded Read Gate contracts; not Operation Preview |
| macOS native-backed Zen Preview | Use stronger system-native rendering for reviewed strong-native formats inside the existing Zen Quick Preview experience | W4 adapter/presentation extension of `ZenFloating` / `ZenPinned`; preserves Managed/Ephemeral source identity, uses bounded Native Preview Access and host-bound `NativeOpaque`, and is not a Finder Preview Extension by default |
| Windows Explorer Preview Pane | Preview deliberately supported content from Explorer without launching the normal Zen UI | W4 shell-hosted read-only integration using request-scoped `HostProvided` ownership; not a second Preview/provider/read authority and not a Zen Floating window embedded in Explorer |
| Operation Preview & Execute | Review exact filesystem operations before execution | Contextual workflow/view over server-authoritative Operation Preview and revalidation; separate from content Quick Preview |
| Content Understanding | Extract/understand managed content under explicit policy and consent | Dedicated/contextual surface over Content Policy/Run/Artifact; not a sidebar primary workspace and not Global Search or filesystem mutation authority |

### Global Search versus File Library Search

They are separate products over separate authorities:

- Global Search answers “where is it?” over Global Index metadata and commands.
- File Library Search answers “which managed files match this managed-library query?” through File Library Query V2.
- Content Search operates only over managed Content Artifacts and must not silently merge into Global Search.

### Content Quick Preview versus Operation Preview

The word “preview” names two different product concepts and they must remain separate:

- **Content Quick Preview** answers “what is this item?” and is read-only. W3 owns the Zen Floating/Pinned experience; W4 may add native-backed rendering inside those hosts and a bounded Explorer Preview Pane integration.
- **Operation Preview** answers “what filesystem change will happen?” and remains part of the mutation/revalidation/journal chain.

Native rendering does not authorize mutation, and Operation Preview does not become a content renderer.

### Native preview ownership

W4 intentionally exposes different native value on each platform rather than forcing feature symmetry:

- on supported Apple Silicon macOS, the initial native product surface is stronger system-native rendering **inside the existing Zen Quick Preview** for reviewed formats; a Finder Quick Look Preview Extension remains conditional on separately reviewed ownership/value;
- on Windows, the native system surface is the normal **Explorer Preview Pane** through a Zen Preview Handler for a deliberately reviewed content matrix; `WindowsQuickPreview` remains a reserved contract, not a second global preview product.

Neither surface may create renderer path authority, implicit cloud hydration, a second provider stack or a second durable source/read authority.

### Preview and recovery

Any user-file mutation must preserve the product chain:

```text
intent
→ authoritative operation preview
→ explicit confirmation where required
→ backend revalidation
→ operation/cleanup journal
→ filesystem mutation
→ durable outcome
→ History / Restore
```

No product workspace may create an alternate executor or recovery ledger. Content Quick Preview, including native-backed W4 surfaces, remains outside this mutation chain and read-only.

### AI boundary

AI/provider results are advisory unless an existing durable contract says otherwise. AI must not silently authorize filesystem mutation, enable rules, execute rules, send cloud content, accept Organization Plan decisions or bypass confirmation.

## Platform experience

The same core Zen product concepts exist on Windows and supported Apple Silicon macOS, while platform adapters may select different safe filesystem and native-preview strategies. The backend/native boundary owns those platform decisions. The renderer must not infer mutation/read safety from paths, extensions or OS-name checks.

W4 native integration is explicitly capability/value driven: macOS may use stronger native rendering inside Zen while Windows exposes Explorer Preview Pane integration. Product quality is measured by truthful native behavior and preserved authority boundaries, not by equal feature counts.

## Product evolution

File Library 2.0 and the Zen Preview Platform are completed foundations. Native Integration extends those existing workspace, Preview, Read Gate, journal, Safe Trash and platform authorities rather than building replacements beside them.

Release/Hardening work remains a later governance step and must not be inferred as active merely because native product surfaces are recorded here; `STATUS.md` and `ROADMAP.md` own current sequencing truth.
