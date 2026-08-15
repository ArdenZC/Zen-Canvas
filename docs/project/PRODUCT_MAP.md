# Zen Canvas Product Map

Zen Canvas is a local-first personal file lifecycle assistant. It does not replace Finder or File Explorer as the operating system's canonical filesystem browser. It adds managed indexing, review, preview, safe execution and recovery around user files.

This map describes product ownership. Durable implementation authority is defined in `ARCHITECTURE_MAP.md`.

## Primary workspaces

| Workspace | User purpose | Product boundary |
| --- | --- | --- |
| Overview | See coverage, health and work that needs attention | Summary/projection only; it does not invent counts or lifecycle truth |
| Global Search | Find files and commands across configured global index sources | Global metadata search; separate from managed File Library search and Content Search |
| File Library | Browse and inspect managed files, filters, tags, saved views and selection | Managed-file workspace; future File Library 2.0 work must preserve Query V2 authority |
| Organize Files | Review organization proposals and decide what may proceed | Durable Organization Plan review; not a second filesystem executor |
| Storage Cleanup | Analyze storage findings and move confirmed findings through the safe cleanup path | Durable Analysis findings plus Safe Trash; no renderer-owned cleanup truth |
| Preview & Execute | Review exact filesystem operations before execution | Server-authoritative Operation Preview and revalidation |
| History & Restore | Understand changes, restore recoverable work and resolve recovery cases | Operation/cleanup ledgers and identity revalidation |
| Automation | Browse, create, review, enable and run rules | Rule Repository V2 plus durable Rule Proposal; Apply, Enable and Run remain separate |
| Content Understanding | Extract/understand managed content under explicit policy and consent | Content Policy/Run/Artifact; does not become Global Search or filesystem mutation authority |
| Settings | Configure app, search, indexing, AI/provider, lifecycle and diagnostics | Persisted settings/provider contracts; technical detail remains secondary to task language |

## Cross-cutting product surfaces

### Global Search versus File Library Search

They are separate products over separate authorities:

- Global Search answers “where is it?” over Global Index metadata and commands.
- File Library Search answers “which managed files match this managed-library query?” through File Library Query V2.
- Content Search operates only over managed Content Artifacts and must not silently merge into Global Search.

### Preview and recovery

Any user-file mutation must preserve the product chain:

```text
intent
→ authoritative preview
→ explicit confirmation where required
→ backend revalidation
→ operation/cleanup journal
→ filesystem mutation
→ durable outcome
→ History / Restore
```

No product workspace may create an alternate executor or recovery ledger.

### AI boundary

AI/provider results are advisory unless an existing durable contract says otherwise. AI must not silently authorize filesystem mutation, enable rules, execute rules, send cloud content, accept Organization Plan decisions or bypass confirmation.

## Platform experience

The same product concepts exist on Windows and supported Apple Silicon macOS, while platform adapters may select different safe filesystem strategies. The backend owns those platform decisions. The renderer must not infer mutation safety from paths or OS-name checks.

## Future product work

File Library 2.0 and the Preview Platform are the next planned product-design initiative after Engineering OS installation. That initiative must extend the existing managed-library, preview, journal, Safe Trash and platform authorities rather than build replacements beside them.
