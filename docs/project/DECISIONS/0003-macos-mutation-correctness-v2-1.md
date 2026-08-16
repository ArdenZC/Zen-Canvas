# ADR-0003: macOS Mutation Correctness V2.1 Provider and Portability Closeout

Status: accepted — user-authorized high-risk remediation

Date: 2026-08-16

## Context

The V2 implementation established descriptor-backed identity and recoverable
namespace transactions, but the closeout audit found four remaining places
where a platform label could be mistaken for an execution proof: Safe Trash
coordination, generic File Provider identity, explicit provider content access,
and portable source retirement. The original PR implementation also treated
the public File Provider item/domain translation APIs as if a normal desktop
client could thereby obtain the authority of an arbitrary third-party
provider extension.

## Apple public API evidence

The decision is based on the public File Provider documentation and the public
symbols compiled by the exact macOS CI SDK. The relevant Objective-C contracts
are:

| API | Public contract inspected | Availability / ownership consequence |
| --- | --- | --- |
| `+ getIdentifierForUserVisibleFileAtURL:completionHandler:` | `NSURL *` plus a callback receiving `NSFileProviderItemIdentifier`, `NSFileProviderDomainIdentifier` and `NSError *`; Apple documents `NSFileNoSuchFileError` when the URL is not managed by **your File Provider extension** | Public on the target macOS SDK; symbol availability is satisfied by Zen’s macOS 13+ target, but the documented “your extension” restriction is decisive for applicability |
| `+ managerForDomain:` | `+ (instancetype)managerForDomain:(NSFileProviderDomain *)domain` | The domain is an `NSFileProviderDomain`, documented as a File Provider extension’s domain. It is not a discovery or adoption API for an unrelated provider’s domain |
| `- requestDownloadForItemWithIdentifier:requestedRange:completionHandler:` | Instance method taking an `NSFileProviderItemIdentifier`, optional `NSRange`, and an error callback | The operation is reached through a manager for a provider-extension domain; an item/domain pair returned by the system does not grant Zen authority to schedule another extension’s download |
| `- getUserVisibleURLForItemIdentifier:completionHandler:` | Instance method returning `NSURL *` or `NSError *` | Apple documents that calling it marks the process so accessing an unmaterialized URL will not materialize it; reads/writes instead fail with `EDEADLK`. It is therefore a non-materializing extension-owned lookup, not a generic download mechanism |
| `NSFileProviderDomain` | A File Provider extension’s domain; adding a domain creates an extension instance | The domain model confirms that domain identifiers are extension-owned state |

The first and fourth entries are documented directly in Apple’s pages for
[`getIdentifierForUserVisibleFileAtURL:`](https://developer.apple.com/documentation/fileprovider/nsfileprovidermanager/getidentifierforuservisiblefile%28at%3Acompletionhandler%3A%29)
and
[`getUserVisibleURLForItemIdentifier:`](https://developer.apple.com/documentation/fileprovider/nsfileprovidermanager/getuservisibleurl%28for%3Acompletionhandler%3A%29).
The manager/domain ownership is documented in
[`NSFileProviderManager`](https://developer.apple.com/documentation/fileprovider/nsfileprovidermanager),
[`managerForDomain:`](https://developer.apple.com/documentation/fileprovider/nsfileprovidermanager/init%28for%3A%29),
and
[`NSFileProviderDomain`](https://developer.apple.com/documentation/fileprovider/nsfileproviderdomain).

## Decision

1. Keep Operation Preview, the operation journal, Safe Trash, cleanup ledger
   and Restore ledgers as the only durable mutation authorities.

2. **Decision B — the item/domain APIs are provider-extension-scoped and are
   not relied upon by Zen for arbitrary OneDrive, Dropbox, Google Drive or
   other third-party File Provider items.** This is an applicability decision
   derived from Apple’s documented “your File Provider extension” and domain
   ownership model; it is not a claim that the APIs are unavailable or that a
   particular provider can never expose an integration to its own client.

3. The generic third-party provider client model is:

   `NSFileCoordinator` + provider/user-visible URL + filesystem physical
   identity + operation-scoped revalidation.

   `NativeItemDomain` remains a typed diagnostic boundary for a future
   extension-owned integration, but it is not produced by ordinary inspection,
   is not required for generic mutation, and is not used as generic provider
   authority. A CloudStorage path is only a cheap routing hint.

4. Rename, Move, Safe Trash and Restore use the existing operation-specific
   `NSFileCoordinator` contracts. The coordinator-supplied actual source and
   target URLs are revalidated against physical identity before the existing
   Level-B claim/transaction runs. Journal and cleanup records retain the
   actual accessor paths; renderer paths are never execution truth.

5. Copy, Duplicate, Replace, Content Understanding and full-content Quick
   Look remain behind a content-local gate. Preview, listing, indexing,
   thumbnails and background understanding never materialize provider content.
   An explicit user action may run coordinated content access. Its bounded
   first/last-range proof is `BoundaryReadable`, not full materialization; the
   eventual byte operation reopens and consumes the source once and performs
   its own operation-time identity checks. The bounded cache records only a
   recent explicit proof and never represents current provider truth after an
   eviction.

6. Portable source retirement is target-first and recoverable. macOS uses a
   Zen-owned `.zen-canvas-retirement/<random-session>/` namespace with mode
   `0700`, retained parent identity, no-follow opens, exclusive publication and
   identity checks. Files, directories, packages and symlinks use the same
   claim authority. The Darwin `linkat` plus pathname `unlinkat` fallback is
   absent. If a target has been verified but source retirement cannot be
   proved, the operation remains `source_cleanup_pending` and the source is
   retained for existing recovery/manual-review paths.

7. Runtime capability layers distinguish implementation, runtime environment
   and operation eligibility. `file_provider_mutation_available` means only
   that the coordinated URL production route exists on macOS; it does not
   claim that every provider item is online, writable, materialized or fixture
   validated. Real provider, iCloud, external APFS, exFAT and SMB fixtures are
   **NOT VERIFIED — fixture unavailable** when not supplied.

8. Cancellation cancels Zen’s wait and prevents the subsequent mutation. It
   does not claim to cancel a provider/system fetch unless a public API with
   that guarantee is implemented.

## Non-goals

- a new mutation journal, queue, schema version or recovery authority;
- private Apple APIs, Endpoint Security, a System Extension or a privileged
  helper;
- passive provider downloads, content scans, dedupe reads, AI reads or
  thumbnail materialization;
- automatic network disconnect/reconnect simulation;
- Intel macOS, Rosetta, Universal binaries, Linux, signing or notarization.

## Acceptance gates

- generic provider authority is the coordinated URL/physical-identity route,
  never a fabricated item/domain pair;
- ordinary local inspection does not perform a provider manager lookup;
- materialization states distinguish `DownloadRequested`,
  `BoundaryReadable`, `FullyConsumable`, `ProviderNative` and unknown/remote
  states;
- private portable retirement has no pathname-delete fallback and retains
  ambiguous claims for manual review;
- Preview has zero filesystem, coordinator-download and provider-download side
  effects;
- Windows handle-bound mutation and recovery regressions remain green;
- native macOS evidence is bound to the exact final PR head;
- absent real fixtures are reported as **NOT VERIFIED — fixture unavailable**,
  never as a provider or external-volume pass.

## Consequences

Some macOS paths become more visibly unavailable than their platform name
alone suggests. That is intentional: the backend reports what the current
runtime, mounted volume and coordinated URL can prove, while preserving the
existing preview, journal, Safe Trash and Restore recovery chain.
