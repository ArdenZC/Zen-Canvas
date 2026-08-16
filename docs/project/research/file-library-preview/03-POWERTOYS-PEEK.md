# Microsoft PowerToys Peek — Research Notes

Official sources:

- https://github.com/microsoft/PowerToys
- https://learn.microsoft.com/windows/powertoys/peek

Audit snapshot: see [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md).

> **Provenance:** this note is a 2026-08-17 reconstruction of the Zen research conclusion, not a verbatim original W-1 notebook. Current Peek behavior/release facts were re-verified from Microsoft sources during the audit.

## Why we studied it

PowerToys Peek was one of the strongest Windows references for **quick-preview lifecycle**, especially because it solves a problem similar to macOS Quick Look without requiring Windows to share macOS's native extension model.

The research question was:

> What should Zen learn from a production Windows quick-preview utility about session lifetime, cancellation, cleanup and native fallback?

## Re-verified official-source facts

Microsoft's current Peek documentation describes a system-wide Windows utility for previewing files without opening full applications, including keyboard navigation across files and folder summary support.

PowerToys release documentation also records a Peek fix for **media files remaining locked after the preview window closes**. That is a concrete production example of why Preview handle/resource lifetime can interfere with later file operations.

Sources:

- https://learn.microsoft.com/windows/powertoys/peek
- https://github.com/microsoft/PowerToys/releases

The Zen architecture conclusions below are design inferences from those product/failure lessons; they are not claims that Peek internally uses Zen's `PreviewSession`, WorkScheduler or provider contracts.

## Main observations

### 1. Preview must be disposable

A quick preview is not a document-opening workflow. Users expect to:

- invoke it;
- inspect something;
- rapidly switch files;
- close it;
- immediately rename/move/delete/open the same file.

That requires deterministic release of file handles, native preview objects, decoders and temporary resources.

### 2. Cancellation is a first-class lifecycle event

Preview work can outlive the user's interest unless explicitly cancelled.

Zen therefore treats source switch, close, host destruction and app shutdown as publication-right revocation events, not merely visual state changes.

### 3. Native preview capability is useful but should remain behind an adapter

Windows has existing preview-handler/native mechanisms, but Zen's Preview Core should not be built around one specific native hosting mechanism.

The research led to an explicit distinction:

```text
Zen Quick Preview Host != Windows Explorer Preview Handler
```

A Zen Space-style quick-preview host can be a first-class app capability. Explorer Preview Handler integration is a later native-integration option with different lifecycle and security constraints.

### 4. Cleanup deserves explicit tests

The PowerToys locked-file history reinforced a concrete Zen QA rule:

```text
Open Preview
-> Ready
-> Close
-> immediately Rename / Move / Delete / Open
```

This is a correctness gate, not merely a performance test.

### 5. Preview cannot own an unlimited resource pool

Native handlers, media decoders and helper processes consume real OS resources. Zen therefore routes Preview work through bounded scheduler/resource contracts rather than allowing every session/provider to spawn arbitrary work.

## Adopted by Zen

- `PreviewSession` as a disposable lifecycle authority;
- explicit cancellation/publication-right revocation;
- deterministic cleanup as a merge/release gate;
- native Windows preview capability behind host/provider adapters;
- Windows Quick Preview host separated from Explorer Preview Handler integration;
- resource budgeting and timeout behavior treated as core infrastructure.

## Adapted, not copied

PowerToys Peek is a Windows utility inside a Windows-only suite. Zen needs one Preview Core that can support:

- Zen floating/pinned hosts;
- macOS native Quick Look integration;
- Windows Zen Quick Preview;
- later native/system hosts where justified.

So Zen borrows lifecycle lessons, not PowerToys UI or module architecture wholesale.

## Explicitly rejected

- binding Preview Core directly to a Windows Preview Handler;
- considering window close sufficient if handles/resources remain alive;
- allowing provider work to keep publishing after a source switch;
- relying on UI tests alone instead of deterministic cleanup/cancellation tests;
- blocking the Preview shell while native/provider work completes.

## Downstream influence

- W0-D Preview Session / Host architecture;
- W0-F rapid-switch and cleanup QA;
- W1-05 WorkScheduler;
- W1-06 Preview Contract Core;
- W3 Quick Preview UX;
- W4 Windows native integration evaluation.

## Design statement preserved from the reconstructed research

> Windows quick preview is a lifecycle problem as much as a rendering problem. A preview that looks correct but keeps the file locked, cannot cancel, or binds Zen to one native host is architecturally incomplete.