# W0-F — Performance Budget and QA Matrix

## 1. Gate classes

- **HARD GATE** — failure blocks release/Track closeout.
- **TARGET** — expected product target; deviation requires performance review.
- **OBSERVATIONAL** — instrument first, establish real platform baseline, then promote to regression gate.

## 2. Preserve existing Query V2 gates

Existing managed-library performance is not allowed to regress:

- 100k common query p95 <= 100 ms.
- 100k complex first-page p95 <= 150 ms.
- 1M common/complex first-page p95 <= 150 ms where current harness applies.
- File Library detail <= 50 ms in current performance harness.

File Library 2.0 UI changes do not authorize relaxing these limits.

## 3. Standard scales

- S: 1k
- M: 10k
- L: 100k
- XL: 1M

1M is primarily a managed-library/database architecture scale, not a promise that a single one-million-child directory renders as a normal filesystem view.

## 4. Browse performance

For normal local SSD browsing:

- TARGET: target-transition visual feedback <= 100 ms p95.
- TARGET: first useful real entry batch <= 250 ms p95.
- HARD: first content is progressive; never require full-directory enumeration before display.

10k: normal usable.
50k: usable without UI freeze or unbounded memory.
100k: stress-supported — no OOM/app hang/full-scan-first/100k DOM nodes.

## 5. Browse generation/cursor correctness

HARD:

- every Browse page/cursor is bound to the current session/request/enumeration generation;
- watcher invalidation/re-enumeration revokes old cursor/page publication rights;
- a late page from an older enumeration can never append into the new directory view;
- stale/invalid cursor use fails closed and triggers a bounded refresh/restart path rather than silent duplication or omission.

Fixture this with rename/delete/create bursts while paging through a large directory.

## 6. UI responsiveness

HARD: selection, Back/Forward, mode switch, List/Grid, Space and Esc do not wait for indexing, thumbnails, Git, folder analytics, exact counts or network probes.

TARGET: local state-only UI feedback <= 100 ms.

List and Grid are virtualized/windowed for 100k logical results.

## 7. Preview performance

Measure separately:

- Time to Preview Shell.
- Time to Useful Representation.

TARGET:

- Preview shell <= 100 ms p95.
- normal local built-in text/JSON/Markdown/image useful representation <= 300 ms p95.
- native/system first useful representation target <= 1 s where reasonable.

HARD: Preview session/Host shell exists before slow source/provider/materialization work can block cancellation or visual feedback.

HARD: every native/helper/provider path has a bounded timeout and Metadata fallback; no infinite spinner.

## 8. Rapid switching

Test long/rapid navigation through at least 100 entries.

HARD:

- no crash;
- no stale publication;
- no wrong-file preview;
- no unbounded provider/request growth;
- final stopped item is the only item allowed to publish current representation.

## 9. Preview cleanup correctness

For every Provider:

```text
Open -> Ready -> Close -> immediately Rename / Move / Delete / Open
```

HARD: resources are released sufficiently for mutation to proceed immediately.

Session disposal returns provider/request/owned handle/decoder/native host state to a bounded steady state.

## 10. Read-gate / materialization correctness

HARD:

- Materialization/content state is entry/source scoped, not inferred for a whole Location;
- a prior eligibility result does not authorize a later byte read without boundary revalidation;
- Preview/Thumbnail/provider byte consumers use the authoritative platform/content open path or an opaque lease backed by that path;
- no fallback provider bypasses materialization, permission or identity failure by opening/downloading the same source another way.

## 11. Memory and handle instrumentation

W0 does not invent a single absolute RSS limit across WebView/platform combinations.

W1 observational baselines must record release-build:

- idle RSS
- 10k Browse RSS
- 100k Browse RSS
- 100 Preview cycles peak/settled RSS
- file descriptor/handle count before/after Preview and target-switch cycles

HARD: no unbounded monotonic leak pattern.

## 12. Thumbnail QA

HARD:

- cache miss never blocks entry appearance;
- 10k images do not create 10k simultaneous jobs;
- queue is bounded/deduplicated/cancellable/viewport-prioritized;
- offscreen work is cancelled/deprioritized;
- byte-reading thumbnail generation cannot implicitly hydrate provider content;
- durable cross-session thumbnail cache reuse requires stable backend-verified identity; ephemeral refs alone do not qualify.

TARGET: warm memory/disk cached visible thumbnails <= 100 ms.

## 13. Scheduler interference

Scenario: 100k indexing/reconciliation pressure while Browse/Search/Preview are used.

HARD: foreground remains usable and cannot be indefinitely blocked by background work.

HARD: the test must exercise selected existing heavy authorities through Scheduler resource-lease adapters; a synthetic scheduler-only workload is insufficient evidence.

TARGET: foreground latency under background pressure should generally remain within 2x idle baseline; W1 measurements decide whether this becomes a hard regression threshold.

## 14. Startup and recovery

HARD: network drive, external drive, indexing, reconciliation, thumbnails and previous Preview are not prerequisites for window/shell creation.

TARGET: runtime-ready -> interactive shell <= 1 s p95 (excluding OS cold-start/signing/first-install work outside app control).

TARGET: safe local workspace target restoration <= 500 ms; otherwise fall back to safe state.

HARD:

- abnormal previous workspace cannot create an automatic restart death loop;
- cross-process Browse restore never reuses a previous process's `BrowseSessionId`, `BrowsePathRef`, Ephemeral `LocationRef` or `EphemeralEntryRef`;
- a persisted Browse restore locator is re-resolved/revalidated into a fresh session before use.

## 15. Location failure matrix

Both platforms test:

- external drive unplug/replug
- network location slow/offline/reconnect
- permission denied subtree
- watcher burst/overflow

HARD:

- no crash;
- no false mass deletion on disconnect;
- managed metadata remains preserved;
- Browse can leave/cancel a slow location promptly;
- overflow produces reconciliation/refresh rather than false completeness.

## 16. Cloud/provider matrix

Test mixed entries within the same provider-backed location: local, boundary-readable, placeholder, hydrating, unavailable and metadata-only states.

HARD: Library/Browse listing, metadata read, background index, background thumbnail and folder analytics do not implicitly hydrate.

Preview byte requirement must surface explicit materialization where current authoritative eligibility requires it.

A provider-backed directory must not be globally classified local/remote based on one child or pathname alone.

## 17. Platform-specific QA

### Windows 11 x64

- C:/D:/removable drives
- UNC and mapped drives
- slow/offline SMB
- OneDrive/provider placeholders
- long/Unicode paths
- DPI 100/125/150/200%
- multi-monitor / move preview / hot plug / sleep-wake
- Space during selection, rename, search, text entry, IME
- `Alt+Space` remains OS-owned
- native Preview Handler success/unsupported/timeout/crash/retained-handle scenarios

### macOS Apple Silicon

- local APFS
- external APFS/exFAT
- SMB/network volume
- iCloud/provider-backed items
- package/bundle/symlink cases
- sleep/wake
- Low Power Mode / thermal pressure
- Retina / multiple displays
- Quick Look thumbnail and later native Quick Look lifecycle

Intel validation is not part of the product matrix.

## 18. Provider fixtures

Each Preview provider needs at least:

- normal
- large
- corrupt
- permission/unavailable
- cancel during load
- rapid switch away

Hostile fixtures include malformed JSON/XML, truncated/corrupt ZIP, invalid UTF-8, huge-line text, symlink, disappearing/replaced source and provider placeholder.

Fallback tests must prove the explicit matrix: provider-local unsupported/failure/timeout/corrupt conditions may fall through; source/session terminal materialization/permission/identity/cancellation conditions cannot be bypassed by another byte reader.

## 19. Folder Preview

Fixture scales: 1k / 10k / 100k.

HARD: 100k folder does not delay Preview shell until analytics complete.

Immediate content is bounded; total size/type distribution/largest items/project hints are progressive and truthfully marked partial until complete.

Git/project detection is cancellable, budgeted and not an initial Preview prerequisite.

## 20. Accessibility and focus

HARD: primary File Library navigation, selection, search, mode switch, Preview open/close and context navigation are keyboard accessible.

Space -> Preview -> Esc restores focus to the originating entry.

Important UI PRs are reviewed on both platforms, Light/Dark, small/large windows and platform scaling.

## 21. Gate timing by Wave

- W1: 100k ephemeral Browse, enumeration invalidation/cursor correctness, cancellation, scheduler pressure with real heavy-authority adapters, materialization/read gate, watcher isolation, location failure and restore-locator safety.
- W2: 100k virtual List/Grid, mode/history/search switching.
- W3: Preview timing, rapid switching, cleanup, provider fixtures, 100k Folder Preview.
- W4: native lifecycle, Quick Look/Windows host, DPI/display/provider crash behavior.
- W5: full release matrix closeout, not first-time testing.
