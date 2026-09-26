# Resident / Interactive Performance Qualification — Result

Disposition: **BLOCKED / PERFORMANCE REVIEW REQUIRED**. This is a qualification execution record, not owner acceptance. PR [#269](https://github.com/ArdenZC/Zen-Canvas/pull/269) remains Draft; issue [#268](https://github.com/ArdenZC/Zen-Canvas/issues/268) remains open. AI Semantic Authority / AI-only Organize-Cleanup is **GATED / NOT ACTIVE**.

## Identity and scope

| Identity | Value |
| --- | --- |
| Baseline master / Production HEAD | `6d38208741d186988468ec92b632dd3669a03aa5` |
| Activation HEAD | `d58f63a8391df11bbc32e3e65253e52d47c0d5be` |
| Qualification harness candidate HEAD | `fa8d5d799023e7bd735389f55842cddbb948ab04` |
| Final HEAD | The documentation successor containing this record; exact Git commit is reported in the PR closeout and owner response. A document cannot embed its own content-dependent commit hash. |
| Branch | `perf/resident-interactive-qualification` |

At the historical harness candidate `fa8d5d79…`, production behavior was unchanged from the merged baseline; the Rust modification there was test-only raw timing and structural evidence in the existing performance scheduler test. A later continuation authorizes one bounded one-CPU traversal/QoS repair, recorded below. No second scheduler, query authority, schema, provider policy, filesystem authority or execution path is introduced. Existing thresholds and workload definitions remain unchanged. Browser mock timings are separate from native/process evidence.

The common checkout was stale and left untouched. The managed linked checkout is retained for this unresolved Draft qualification. Local generated data was redirected to task-owned F: storage; no owner installation/service/profile was modified.

## Harness and repair history

- `29649ac0a83dfd754aca8da333f67ba5574f57b1`: independent path-routed qualification workflow; existing manifest/backend workloads; three independent real managed-scan observations; Windows exact candidate/disposable service/VHD; macOS isolated background process observer.
- `55589e73a19a93036aac553f98d11ea089bef115`: retain raw idle/pressure samples and explicit structural booleans; existing Preview browser raw timing output and browser qualification.
- `76b2a64a893a33df5f5c8ace95788bdd05bf60ae`: repair two stale static guards against already-merged native lifecycle contracts. The ordinary Rust fast-path exclusion remains enforced; independent native lifecycle tests remain permitted. Search destruction failure handling remains asserted.
- `de9ecd35d71ed80ad80d0ee4f3d6c9810132b9e1`: pass the shared four-suite build identity to existing per-suite validators; preserve raw Windows samples before WebView rejection and record OS HWND class/title; prevent cleanup of a pre-existing profile root; build the normal macOS `.app` for the next real-process attempt; add optional 20-sample Browse DOM timing on the existing integrated fixture. No product target is relaxed.
- `338e064eecce0f1676fb38cf47966ebae36a971c`: the macOS `.app` bundler failed because the Cargo package is `zen-canvas-tauri` and its existing desktop binary is `zen-canvas`. A task-local Tauri override specifies `mainBinaryName=zen-canvas`, with locked Cargo inputs. Candidate build logs/JSON are retained, and a failed candidate build does not prevent independent backend qualification. Final outcome still blocks on any candidate build failure. This override did not fix bundling: the next round still failed, because the feature argument was one quoted space-bearing string, which Cargo accepts but Tauri bundler does not split into required feature names. The temporary config is removed in `finally`.
- `4385f46bf40c3efadcbbbc8065aa4b2c3e06a47d`: replace the inherited fixed settled-window duration with measured UTC start/end and actual duration. Earlier raw timestamps remain authoritative; no sample/threshold/workload changes.
- `fa8d5d799023e7bd735389f55842cddbb948ab04`: pass `desktop-runtime,native-qa` as distinct Tauri features. Upstream CLI uses a comma delimiter and bundle selection matches individual required feature names: [argument parser](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.11.2/crates/tauri-cli/src/build.rs), [binary selector](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.11.2/crates/tauri-cli/src/interface/rust.rs). This is a qualification-command repair; package manifests and production sources are unchanged.

The first two rounds rejected all four normal backend suites **before workload execution** due to the qualification wrapper's combined/per-suite build-identity mismatch. These exits are harness failures, not Search/Browse/Preview measurements or PASS. Dedicated pressure tests still ran from the validated prepared binary.

The first two macOS raw-executable attempts exited with signal `-6`: `fatal runtime error: Rust cannot catch foreign exceptions, aborting`. There were zero settled samples. Those failures are retained; the `.app` attempt does not retroactively qualify them.

The first two Windows observers rejected a nonzero `Process.MainWindowHandle` or WebView child before saving a sample. Tauri startup trace reported `startup_mode=background webview_count=0 labels=` and same-image validation passed, but zero saved samples cannot establish resident PASS. A generic OS HWND is not itself a Main/Search/WebView count; the repaired observer saves native class/title plus direct WebView child state and checks the Tauri lifecycle trace. No `IntPtr` comparison bug is claimed.

## Hosted evidence ledger

| Source | Qualification run | Outcome / durable raw evidence |
| --- | --- | --- |
| `29649ac0…` | [36226836374](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36226836374) | FAILURE; Windows artifact `10901144799`, macOS artifact `10901079065` |
| `55589e73…` | [36227000448](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36227000448) | FAILURE; Windows resident/backend `10901352207`, macOS resident/backend `10901184051`; Windows browser `10900533962`, macOS browser `10900284197` |
| `de9ecd35…` | [36228621585](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36228621585) | FAILURE; Windows resident/backend `10902322666`, browser Windows `10901790949`, browser macOS `10902225764`; macOS bundle build failed before resident/backend execution |
| `338e064e…` | [36229570881](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36229570881) | FAILURE; Windows resident/backend `10902334206`, macOS backend/build `10902189570`; browser Windows `10902327080`, browser macOS `10902047827`; macOS Preview TARGET MISS retained; macOS `.app` bundling failed, so no resident process executed |
| `4385f46b…` | [36231006847](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36231006847) | FAILURE; Windows resident/backend `10902603573`, macOS backend/build `10902687817`; browser Windows `10901928642`, browser macOS `10902364398`; Windows structural failure and two additional macOS Preview misses retained |
| `fa8d5d79…` | [36231343887](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36231343887) | FAILURE; Windows resident/backend `10903340618`, macOS resident/backend/build `10901904834`; browser Windows `10902509472`, macOS `10902731422`; actual macOS background process aborted and all three Windows pressure targets missed |

Artifacts contain machine-readable JSON, human-readable summaries and raw stdout/stderr logs. Exact source/tree, binary hash, runner OS/architecture, profile/fixture identities, sample timestamps, metrics/classifications and cleanup are retained where the observation reached that phase. The local `qualification-evidence-index.json` records raw artifact file hashes, every pressure observation/classification and legacy Search/Library metric lines without changing them. Historical artifacts are downloaded under `F:\_codex_evidence\resident-interactive-qualification-20260926\`; this directory is retained evidence, not temporary fixture data. Hosted artifact retention is 30 days; the local evidence copy preserves the raw record beyond that window.

GitHub step conclusion `success` with `continue-on-error` is **not** a qualification PASS. The raw result JSON and final outcome gate own the qualification disposition.

## Historical resident process observations

| Source / runner | Exact candidate SHA-256 | Application / service result |
| --- | --- | --- |
| `29649ac0…` Windows | `983B2AD48660913F6783B1B30231C39CF3E5527419D1EBABA82AF0E3D0509C68` | Same-image true; background startup trace; zero saved settled samples; `unexpected resident window/WebView for process 3904`; UNVERIFIED |
| `55589e73…` Windows | `AA38E61170A4124A5E129C9267CE9B1648A36A63CBD4EB5CA3E01B3B762D4F94` | Same-image true; background startup trace; zero saved settled samples; `unexpected resident window/WebView for process 1968`; UNVERIFIED |
| Both historical macOS attempts | `f76dd1cfbc82bb32396787631c7b05c48a5a7b8dddd2b5fc6514261e84bc5165` | macOS 26.6.2 / arm64; raw executable aborted with foreign exception; zero settled RSS/fd samples; BLOCKED |

Resident application and Global Index Service are distinct process series; they are never added into one memory number. True process observation does not trim working sets or alter candidate priority. The existing Rust test-process resource sampler remains test-process evidence and is not application RSS attribution.

## Windows real resident baseline at `de9ecd35…`

Source tree `f50560f2dae805a415475062b4c8dbb514446dc6`; candidate SHA-256 `0D35640E8CA16433B76A0C77E17D8DA75E6ABA3172B690DB56C21DA5B1573272`; Windows Server 2025 Datacenter 10.0.26100 / 64-bit. Candidate and separate service both use `D:\a\Zen-Canvas\Zen-Canvas\src-tauri\target\release\zen-canvas.exe`; same-image validation is true. Isolated profile `D:\a\_temp\zb05-global-index-service-36228621585-1\profile` and disposable NTFS/USN fixture were task-owned.

After the initial index/create/rename/delete activity and settlement, each process had 31 raw samples from 08:09:47 to 08:10:20 UTC. The JSON retains every timestamp, PID, image, lifetime, Working Set, private committed bytes, handles, CPU total/delta and window diagnostics. Classification: **HARD PASS / OBSERVATIONAL MEMORY**, confined to this bounded window.

| Process | PID | First → last WS bytes | First → last private committed bytes | Handles | CPU total seconds first → last | Lifetime seconds first → last |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Resident application | 5608 | 21139456 → 21114880 | 6270976 → 6209536 | 215 → 215 | 0.140625 → 0.156250 | 6.33 → 39.44 |
| Global Index Service | 4232 | 11370496 → 11321344 | 1728512 → 1638400 | 153 → 153 | 0.046875 → 0.046875 | 6.63 → 39.74 |

Both series have zero WebView children. Tauri startup reports `startup_mode=background webview_count=0 labels=`; no Main/Search creation occurred during observation. The application's nonzero generic HWND is class `com.startlan.zencanvas-sic`, title `com.startlan.zencanvas-siw` (single-instance communication window), while the service HWND is zero. This explains the earlier observer rejection without retroactively upgrading the zero-sample attempts.

At source `338e064e…`, tree `468c5f132d1d5a4ab8e9b7d2993820674dc1d615`, candidate hash `225F1E78955C0B13A9D2FCA15FC15C5A077774EF5041BD1B99F4B1F2EB54A82A`, another 31+31 process samples passed the same bounded correctness/observational checks. App PID 5848: WS 20979712 → 20951040 bytes, private committed 6221824 → 6156288 bytes, handles 214 → 214, CPU total 0.140625 → 0.140625 seconds, lifetime 8.51 → 42.10 seconds. Service PID 7888: WS 11448320 → 11399168 bytes, private committed 1830912 → 1740800 bytes, handles 153 → 153, CPU total 0.031250 → 0.031250 seconds, lifetime 8.89 → 42.46 seconds. Same-image is true, WebView children zero, cycle/wait deltas zero, all service/process/VHD/fixture/profile cleanup true. macOS at this source has only the failed `.app` build (exit 1), not a resident launch or new binary hash.

No strict monotonic private-commit/handle growth was detected. Provider `windows_mft_usn` and service route were observed. The coordinator trace counters bracket the extended resident sample window and have cycle delta 0 and wait delta 0. The inherited JSON field `settledIdleWindowMs=10000` is a stale metadata constant from the non-resident script path, not the actual extended duration; raw sample timestamps establish approximately 33.1 seconds. That metadata limitation is explicitly retained and is not used as a ten-second measurement claim. No continuous coordinator loop is claimed in that observed window; it is not an indefinite soak result. All disposable service/process/VHD/fixture/profile cleanup booleans are true.

## Every independent managed-scan observation

The authoritative target is `pressure_first_page_p95_us <= 2 * idle_first_page_p95_us`. `foreground_wait_ms` includes the intentional approximately 100 ms cancellation delay and is not this ratio target. All rows below are from separate fresh processes using the same prepared binary within each source/runner round. Every row's structural classification was **HARD PASS**. No miss is discarded or averaged into success.

| Source | Runner | Observation | Idle p95 µs | Pressure p95 µs | Ratio | Foreground wait ms | Target |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `29649ac0…` | Windows | 1 | 214 | 753 | 3.518692 | 1387 | TARGET MISSED |
| `29649ac0…` | Windows | 2 | 215 | 959 | 4.460465 | 2981 | TARGET MISSED |
| `29649ac0…` | Windows | 3 | 199 | 502 | 2.522613 | 707 | TARGET MISSED |
| `29649ac0…` | macOS arm64 | 1 | 119 | 62 | 0.521008 | 247 | TARGET MET |
| `29649ac0…` | macOS arm64 | 2 | 50 | 90 | 1.800000 | 133 | TARGET MET |
| `29649ac0…` | macOS arm64 | 3 | 48 | 27 | 0.562500 | 141 | TARGET MET |
| `55589e73…` | Windows | 1 | 144 | 749 | 5.201389 | 1065 | TARGET MISSED |
| `55589e73…` | Windows | 2 | 129 | 291 | 2.255814 | 1735 | TARGET MISSED |
| `55589e73…` | Windows | 3 | 130 | 321 | 2.469231 | 3656 | TARGET MISSED |
| `55589e73…` | macOS arm64 | 1 | 85 | 29 | 0.341176 | 232 | TARGET MET |
| `55589e73…` | macOS arm64 | 2 | 47 | 74 | 1.574468 | 217 | TARGET MET |
| `55589e73…` | macOS arm64 | 3 | 38 | 338 | 8.894737 | 423 | TARGET MISSED |
| `de9ecd35…` | Windows | 1 | 198 | 669 | 3.378788 | 2342 | TARGET MISSED |
| `de9ecd35…` | Windows | 2 | 207 | 909 | 4.391304 | 465 | TARGET MISSED |
| `de9ecd35…` | Windows | 3 | 202 | 364 | 1.801980 | 2380 | TARGET MET |
| `338e064e…` | Windows | 1 | 209 | 1976 | 9.454545 | 711 | TARGET MISSED |
| `338e064e…` | Windows | 2 | 201 | 456 | 2.268657 | 3058 | TARGET MISSED |
| `338e064e…` | Windows | 3 | 346 | 475 | 1.372832 | 984 | TARGET MET |
| `338e064e…` | macOS arm64 | 1 | 41 | 32 | 0.780488 | 380 | TARGET MET |
| `338e064e…` | macOS arm64 | 2 | 54 | 38 | 0.703704 | 684 | TARGET MET |
| `338e064e…` | macOS arm64 | 3 | 57 | 36 | 0.631579 | 281 | TARGET MET |

An additional existing full-suite Windows observation at `de9ecd35…` also missed: idle 197 µs, pressure 676 µs, ratio 3.431472, foreground wait 2516 ms, structural HARD PASS. It is preserved alongside the required three independent observations.

The `338e064e…` full-suite Windows pressure observation also missed: idle 212 µs, pressure 518 µs, ratio 2.443396, foreground wait 559 ms, structural HARD PASS. The macOS full-suite pressure observation met its target; all three dedicated macOS successes above do not erase the historical macOS miss.

The later historical round retains all twenty idle samples, twenty pressure samples, foreground admission, observed pressure, background progress after release, cancellation release, scheduler settlement and runtime settlement in each `interactive.json`. The first round predates raw-vector/explicit-boolean instrumentation; its scalar metrics and raw logs remain preserved, and HARD PASS used the existing assertions.

## Diagnosis and bounded remediation disposition

Windows has a reproducible ratio miss across two runner executions; the macOS miss is also retained. Absolute sub-millisecond times do not waive the unchanged ratio target.

- Host noise: historical observations did not capture per-observation host CPU/memory counters; they cannot isolate host contention. The repaired wrapper captures before/after CPU times and available memory without changing the workload. These counters are coarse observations, not causal profiling.
- Fixture distortion: the authoritative split fixture creates at least 100k entries in child scan roots, while the timed Browse first page enumerates the root containing those child directories. This very short operation is sensitive to scheduling/metadata overhead. The fixture and threshold are preserved; this fact is a limitation, not permission to reclassify a miss.
- Scheduler/background capacity: the real test occupies the policy's actual background CPU/IO slots and requires an additional real scan to progress after release. Structural gates passed through `338e064e…`; the later `4385f46b…` independent observation 3 failed background progress, as recorded below. The observed-pressure snapshot proves real scanner lease occupancy, not a synchronized per-walker I/O activity trace during the sub-millisecond Browse samples; background progress is separately asserted after release. This is a measurement limitation, not a waiver of the ratio miss. Foreground priority orders eligible queued work; it does not preempt an existing lease. The foreground-wait measurement is distinct from the Browse first-page ratio.
- Scanner behavior: each managed scan acquires `ManagedScanResourceLeaseAdapter`; jwalk parallelism is derived from the granted CPU lease. The hypothesis of unconstrained scanner walker threads is not supported by the inspected code.
- Browse contention: the measured Browse route performs real `read_dir`/page work through the existing Browse authority. Scan persistence uses a separate fixture database, so the measurement is not a direct shared scan-database query. OS/filesystem/CPU competition remains plausible but unproven. No causal shared-lock profile has been captured.

No production repair is applied: the evidence supports a repeatable qualification miss, but does not establish a responsible minimal production change. No arbitrary sleep/yield, foreground special route, scheduler bypass or capacity tuning is used to improve the number. **PERFORMANCE REVIEW REQUIRED** remains blocking even if a later independent observation meets the target.

The `de9ecd35…` Windows runner exposed four logical CPUs. Whole-observation CPU busy fractions were approximately 57.3%, 53.8%, 58.1%; available memory remained approximately 13.6–13.9 GB. These include fixture setup/cancellation/cleanup and do not isolate the sub-millisecond Browse measurement. They do not establish host noise as the cause; they also do not support an OOM diagnosis.

## Search / Browse / Preview and settlement

The first two historical full backend suites were rejected before execution and cannot qualify Search 100k/1M, real Browse 100k/progressive enumeration, Preview native/system latency or resource epochs. Their raw rejection logs are retained. All four full suites executed with exit 0 on Windows `de9ecd35…`; pressure TARGET MISS still makes the wrapper require review.

| Existing authority metric, Windows `de9ecd35…` | Observed result | Existing target / disposition |
| --- | ---: | --- |
| Global Search 100k / 1M p95 | 57.090 / 1.487 ms | 100 ms in current harness; passed |
| File Library 100k common / complex first-page p95 | 1.642 / 60.157 ms | 100 / 150 ms; passed |
| File Library 1M common / complex first-page p95 | 1.129 / 87.990 ms | 150 / 150 ms; passed |
| File Library 100k / 1M detail | 0.583 / 0.437 ms | 50 ms; passed |
| Real Browse 100k first page | 5 ms, progressive bounded ownership HARD PASS | Single backend observation, not DOM p95 |
| Preview backend shell p95 | 0.0362 ms | OBSERVED backend boundary, not visible DOM |
| Built-in Preview useful p95 | 0.9275–21.8983 ms across existing provider fixtures | OBSERVED; raw provider rows retained |
| Native/system Preview first useful | Not applicable to Phase A Zen host | `applicable=false`; 1s native target UNVERIFIED |

The raw library log also retains the initial 1M `modified_desc_page_1` observation 176.395 ms, empty duplicate-filter query 553.675 ms, deferred exact-count p95 1640.1052 ms and selection-summary 3391.504 ms. Those are not silently dropped or substituted for the existing authoritative common/complex p95 computation; exact count has an explicitly separate existing contract and no false 150ms gate. The raw SQLite/FTS pre-optimization probe was 42447.497 ms total; post-optimization search p95 was 3.469 ms. FTS pre-optimization is a diagnostic phase, not the qualified query phase.

Windows resource epochs: five epochs × twenty cycles for Preview/Thumbnail/target switching; internal registries settle to zero, handles remain `[146,146,146,146,146]`, private committed settled series `[6565888,6623232,6524928,6643712,6991872]` bytes. Existing hard growth detector, signal availability and registry gates pass. Windows test-process RSS is explicitly post-trim diagnostic; the thumbnail renderer is `test.performance`, not native thumbnail qualification.

At `338e064e…`, all four backend suites exited 0 on Windows and native arm64 macOS. Global Search 100k/1M p95: Windows 46.833/1.211 ms, macOS 32.168/2.910 ms. File Library 100k common/complex p95: Windows 1.418/56.877 ms, macOS 2.251/83.301 ms. 1M: Windows 1.497/88.706 ms, macOS 5.366/50.489 ms. Detail 100k/1M: Windows 0.474/0.449 ms, macOS 0.782/0.333 ms. These existing target assertions passed; all raw lines and separate exact-count/selection/migration metrics remain in the downloaded logs/index. macOS backend COMPLETE is not application resident qualification.

The separate Phase A Preview test-process private committed series `[4878336,5013504,5050368,5095424,5369856]` bytes rises across its five samples. That existing metric is observational while the internal registry gate passes; it is retained as an unresolved resource-trend observation, not an attributable resident leak or a no-leak PASS. No longer-duration allocation attribution was performed. True resident processes above remain separately measured and untrimmed.

The `55589e73…` browser qualification completed on both hosted Windows and macOS with no Preview shell/useful target miss across nine scenarios at 1600×900 and 980×680. Existing integrated Browse stress/resource scenes passed. These browser results do not prove native/system rendering or true filesystem entry timing; Browse was a single first-content observation before the optional p95 instrumentation.

The optional Browse p95 development check passed locally on the uncommitted repaired harness: 20 measured samples after three warmups per viewport; feedback/useful p95 12.6/46.7 ms at 1600×900 and 9.7/40.3 ms at 980×680. This is development evidence, not exact-candidate hosted qualification. Hosted final candidate data must remain separate.

Native/system useful representation, real macOS GUI/Retina, DPI and release/package qualification are not claimed. A normal `.app` build is solely the background-process launch environment for this Track.

Hosted Browse DOM p95 at `de9ecd35…` (twenty raw samples after three warmups): Windows feedback/useful 17.6/80.0 ms at 1600×900, 13.1/70.0 ms at 980×680; macOS 13.5/60.6 ms and 10.0/46.4 ms. Both browser jobs reported no target miss and task cleanup true. These are mock entry batches, not a native real-entry p95 claim.

At `338e064e…`, macOS browser structural runs both exited 0 but `library-image` at 980×680 recorded shell p95 **287.3 ms > 100 ms** and useful p95 **400.8 ms > 300 ms**. Both are **TARGET MISSED / PERFORMANCE REVIEW REQUIRED** and remain in `browser.json` plus all raw Preview samples. The same source has Browse feedback/useful p95 Windows 17.5/76.4 ms and 15.3/64.6 ms, macOS 21.4/62.1 ms and 17.9/72.0 ms at 1600×900 and 980×680 respectively; each retained twenty samples. Windows browser had no target miss and both browser task-cleanup booleans are true. Previous browser success does not erase this observation. At `4385f46b…`, macOS `library-markdown` at 1600×900 also missed: shell p95 **276.7 ms > 100 ms**, useful p95 **315.6 ms > 300 ms**. Both classifications and all twenty samples remain preserved; Windows browser had no miss, and both browser task cleanups are true. No causal rendered-product diagnosis or production repair is inferred from these long-tail hosted observations across different provider scenarios.

## Later raw observations and additional blocking evidence

At `4385f46b…`, Windows tree `f012f253ae529dd97411212bd9e2f3abc5d81f90`, binary SHA-256 `0C6DB3371ED6437B36CDA211D447789F1C05A0452ACE9396699A106752758FA4`, resident correctness remains HARD PASS / OBSERVATIONAL MEMORY. Thirty-one separate samples per process: application PID 3512 WS 20905984 → 20881408 bytes, private committed 6139904 → 6078464, handles 214 → 214, CPU total 0.109375 → 0.125 seconds, lifetime 6.95 → 40.29 seconds; service PID 3936 WS 11378688 → 11329536, private committed 1761280 → 1671168, handles 153 → 153, CPU 0.046875 → 0.046875 seconds, lifetime 7.27 → 40.60 seconds. WebView children are zero, same-image is true, coordinator cycle/wait deltas are zero. Correct measured coordinator window 08:58:06.766440–08:58:44.213081 UTC is 37447 ms; the sample series starts 08:58:10.804744. All disposable cleanup booleans are true. macOS `.app` build still exited 1 at this source and no resident process was launched; its independent backend suites ran successfully.

| Source | Runner | Independent observation | Idle p95 µs | Pressure p95 µs | Ratio | Foreground wait ms | Structural | Target |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `4385f46b…` | Windows | 1 | 202 | 398 | 1.970297 | 3990 | HARD PASS | TARGET MET |
| `4385f46b…` | Windows | 2 | 230 | 395 | 1.717391 | 3790 | HARD PASS | TARGET MET |
| `4385f46b…` | Windows | 3 | 240 | 613 | 2.554167 | 3503 | BLOCKED | TARGET MISSED |
| `4385f46b…` | macOS arm64 | 1 | 31 | 35 | 1.129032 | 560 | HARD PASS | TARGET MET |
| `4385f46b…` | macOS arm64 | 2 | 67 | 38 | 0.567164 | 391 | HARD PASS | TARGET MET |
| `4385f46b…` | macOS arm64 | 3 | 53 | 33 | 0.622642 | 224 | HARD PASS | TARGET MET |
| `fa8d5d79…` | Windows | 1 | 204 | 520 | 2.549020 | 1200 | HARD PASS | TARGET MISSED |
| `fa8d5d79…` | Windows | 2 | 196 | 433 | 2.209184 | 2124 | HARD PASS | TARGET MISSED |
| `fa8d5d79…` | Windows | 3 | 204 | 465 | 2.279412 | 1243 | HARD PASS | TARGET MISSED |
| `fa8d5d79…` | macOS arm64 | 1 | 42 | 41 | 0.976190 | 141 | HARD PASS | TARGET MET |
| `fa8d5d79…` | macOS arm64 | 2 | 444 | 39 | 0.087838 | 272 | HARD PASS | TARGET MET |
| `fa8d5d79…` | macOS arm64 | 3 | 67 | 123 | 1.835821 | 298 | HARD PASS | TARGET MET |

`4385f46b…` Windows full-suite pressure also missed: idle 185 µs, pressure 440 µs, ratio 2.378378, wait 1295 ms. All four full suites exited 0, but independent observation 3 exited 101: `background_progressed_after_release=false`; admission, observed real pressure, cancellation lease release, scan-run settlement, scheduler settlement and runtime settlement were true. Existing test waits up to 15 seconds for the extra real scan to leave queued state and observe replacement grant/progress. Its raw result does not establish which of those predicates failed internally, nor a host-noise or scheduler-policy cause. The failure is a separate HARD blocker, not only a latency miss. No deadline extension, assertion weakening, retry-only success replacement or product change is applied. All forty timing samples and structural booleans remain in `interactive.json` and `managed-scan-3.log`.

At `fa8d5d79…`, normal `.app` build exited 0, but the actual background application exited `-6` before settlement: stderr **`fatal runtime error: Rust cannot catch foreign exceptions, aborting`**. macOS 26.6.2 arm64; source tree `aaa12031b7ecac20ddac5bdf971c6e8be557d23f`; candidate SHA-256 `d41f0d752cdc30952b3d7642869c07c0d19a878b7a22d615f3c68060d249f9a9`; Info.plist SHA-256 `4cd97b7f3f3cf85c24e5608f8e32c980703974af22b36d4d6c946d37141eb489`. Exact application `/Users/runner/work/Zen-Canvas/Zen-Canvas/src-tauri/target/release/bundle/macos/Zen Canvas.app/Contents/MacOS/zen-canvas`, task profile `/Users/runner/work/_temp/resident-qualification-kmlghkxg/profile`; zero settled RSS/fd/CPU/lifetime samples. Process-stop/profile cleanup are true. This is BLOCKED, with no attribution of the foreign exception to a specific host or product cause and no GUI/Retina/native acceptance claim. Artifact `10901904834` retains build/result/raw backend evidence.

Existing Search/Library authority at `4385f46b…`: Windows Global Search 100k/1M p95 56.646/1.264 ms; Library 100k common/complex 1.428/54.791, 1M 1.440/95.750, detail 0.501/0.513 ms. macOS Global Search 26.859/0.936 ms; Library 100k 1.456/40.879, 1M 3.542/71.250, detail 0.300/0.633 ms. At `fa8d5d79…` macOS: Global Search 23.103/0.546 ms; Library 100k 0.514/31.832, 1M 1.359/47.599, detail 0.178/0.254 ms. Existing assertions passed. Separate exact-count, selection and all resource/provider rows remain unmodified in raw suite logs and the evidence index; none becomes a new first-page target.

Browser Browse twenty-sample feedback/useful p95 at `4385f46b…`: Windows 8.7/33.7 ms (1600×900), 9.0/37.7 (980×680); macOS 12.5/46.7 and 9.0/46.6. At `fa8d5d79…`: Windows 20.2/74.9 and 17.0/69.8; macOS 53.1/89.0 and 17.4/90.7. Latest browser artifacts Windows `10902509472`, macOS `10902731422` report no Preview/Browse target miss and cleanup true. Historical Preview misses above remain blocking; browser mock entry timings do not qualify native real-entry latency.

Latest Windows `fa8d5d79…` candidate SHA-256 **`800983887CC57AADCF5EB386629CDE213A14B27FC9AD8C863A4CE19FFC7C53C7`**, tree `aaa12031b7ecac20ddac5bdf971c6e8be557d23f`, Windows Server 2025 Datacenter 10.0.26100 / 64-bit: application PID 8776 and separate service PID 6072 both use `D:\a\Zen-Canvas\Zen-Canvas\src-tauri\target\release\zen-canvas.exe`. Each has 31 raw samples. App WS 19992576 → 19959808 bytes, private committed 5730304 → 5668864, handles 209 → 209, CPU total 0.125 → 0.125 seconds, lifetime 17.65 → 50.97 seconds. Service WS 11399168 → 11350016, private committed 1757184 → 1667072, handles 153 → 153, CPU total 0.015625 → 0.015625 seconds, lifetime 17.99 → 51.31 seconds. Background startup has no Main/Search/WebViews, both have zero WebView children; the app's SIC/SIW communication HWND is separately recorded. Same-image validation and provider/service route pass. Coordinator cycle/wait deltas are zero across measured window 09:04:53.978283–09:05:41.999459 UTC (48021 ms); process sample window 09:05:08.610746–09:05:41.934799 UTC. These are bounded attributable observations, not an indefinite no-leak/polling guarantee. All disposable cleanup booleans are true; artifact `10903340618` retains the complete separate series.

All four latest full suites and three independent tests exited 0 on both runners. Latest Windows full-suite pressure **also missed**: idle 185 µs, pressure 501 µs, ratio 2.708108, foreground wait 5436 ms, structural HARD PASS. It remains alongside the three independent misses. All raw structural booleans are true in the latest three independent tests on each runner. Subsequent success does not close the prior Windows background-progress failure or historical macOS/Preview misses.

Latest Windows Global Search 100k/1M p95 is 63.416/1.474 ms; Library 100k common/complex 1.483/67.109, 1M 2.267/103.496, detail 0.584/0.490 ms. Existing assertions pass. Latest real Browse 100k first-page observation is Windows 5 ms, macOS 3 ms (256 entries), with progressive bounded ownership/teardown HARD PASS; these single observations are not real-entry DOM p95 qualification. Backend Preview shell proxy p95 is Windows 0.0047 ms, macOS 0.000834 ms; native useful remains `applicable=false` / UNVERIFIED. Latest browser Preview targets met, but the four retained historical Preview TARGET MISSES remain review blockers.

Latest workspace resource epochs pass the unchanged detector and registry settlement: Windows private committed `[7995392,7970816,6115328,8658944,6823936]` bytes, handles `[146,146,146,146,146]`; macOS test-process RSS `[36257792,36257792,36274176,36274176,36290560]`, fd `[8,8,8,8,8]`. macOS samples have increases interspersed with plateaus, so the existing strict sustained-growth detector is false; this is not attributable application resident RSS. Windows RSS remains post-trim diagnostic. Existing Preview resource registry/steady-state gates pass, while observational allocation series remain retained without conversion into a new no-leak claim. The earlier strictly rising Phase A private series remains unresolved observational evidence.

## CI and local validation

- Normal CI `36226838148` and `36227001409` were canceled after later pushes; canceled/incomplete lanes are not PASS.
- `55589e73…` frontend CI exposed two stale static guards; the bounded test-only repairs are recorded above.
- Normal CI [36227363202](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36227363202) on `76b2a64a…` failed `file_workspace::change::tests::delete_or_rename_hint_is_distinguished_and_coalesced`: fixture-root creation returned Windows code 5 / Access denied. 1035 tests passed, one failed, 24 ignored. No product repair or weakening was applied to this failure.
- Harness normal CI [36228624293](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36228624293) on `de9ecd35…` is **SUCCESS**. Normal CI [36229573109](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36229573109) on qualification candidate `338e064eecce0f1676fb38cf47966ebae36a971c` is **SUCCESS**. Final documentation-head CI must be reconciled separately; a green harness CI does not erase the independent qualification misses.
- Normal CI [36231008935](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36231008935) on `4385f46b…` was automatically canceled by the newer push; it is not PASS. Normal CI [36231346385](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36231346385) on `fa8d5d79…` is **SUCCESS**. Final documentation-head CI is reported with its exact SHA in the PR closeout and owner response after this documentation commit; this source-head success is not substituted for it.
- Local focused static guards: 22/22 passed; local typecheck passed on `de9ecd35…`; JavaScript/Python/PowerShell syntax checks and diff whitespace checks passed during harness development. No local native candidate/service was launched.

## Cleanup and unresolved acceptance

Historical hosted Windows cleanup recorded disposable service stopped/deleted, candidate processes terminated, fixture removed, VHD detached and isolated profile removed. Historical macOS cleanup recorded process stopped and task profile removed. Backend task-owned fixture/binary/temp/cache roots were removed in both rounds. Raw evidence artifacts are intentionally retained.

A local negative test proved refusal in the presence of the installed production service before any SCM control/launch; the pre-existing canary root remained intact. This is cleanup-safety evidence only. Owner production service path/state was inspected read-only and left unchanged.

Local cleanup is **LOCAL TASK HYGIENE PENDING**: automatic approval review rejected both the bounded bulk command and the standalone junction removal command with `blocked by policy`; neither executed. Exact retained junctions under the managed checkout: `node_modules` -> F: task dependencies, `.tmp-tests` -> F: task browser fixtures, `.performance-artifacts` -> retained F: development evidence. Task temporary root `F:\_codex_evidence\resident-interactive-qualification-20260926\local-temp` remains, with `browser-fixtures`, `dependencies`, `node-compile-cache` and `npm-cache`. `local-cleanup.json` records the refusal and no local native launch; read-only process inspection found no task candidate/test process. This is a local policy cleanup limitation, not a product failure. The F: raw evidence directory is retained. No shared Cargo/dependency cache is deletion authority. Cleanup must be verified before reporting completion; policy/lock failures become **LOCAL TASK HYGIENE PENDING**.

Required closeout remains blocked by retained target misses and any incomplete resident/platform/full-suite evidence. The Track is **not complete**, owner acceptance is **not passed**, PR remains **Draft**, and AI remains **gated**. No Ready, Codex Review, merge, release, Rules migration or onboarding work is performed.

## Changed paths and acceptance boundary

The historical qualification harness candidate changed one dedicated workflow; qualification scripts `qualifyInteractiveBrowser.mjs`, `qualifyMacosResident.py`, `qualifyWindowsGlobalIndexService.ps1`, `runResidentInteractiveQualification.mjs`, `sampleWindowsResident.ps1`; optional raw instrumentation in `runW2-11BrowserGate.mjs` / `runW3-10PhaseABrowserHarness.mjs`; test-only `src-tauri/src/file_workspace/integration/performance/scheduler.rs`; two stale static guards; current `STATUS.md`, initiative and this Result. The bounded continuation changes are listed separately below. Earlier activation-only ROADMAP/initiative/taskbook changes are preserved.

## Bounded traversal/QoS repair continuation

Disposition remains **BLOCKED / PERFORMANCE REVIEW REQUIRED** until the repaired exact candidate has completed hosted qualification. Historical records above preserve all 33 independent managed-scan observations and all 19 historical managed-scan ratio misses: 15 in the independent-observation table, including the structurally blocked row that also missed its latency target, plus four separately reported full-suite pressure misses. All four historical Preview shell/useful TARGET MISSES, the prior background-progress HARD failure, the macOS startup abort and the accepted Windows resident baseline remain intact.

The continuation starts from final pre-repair branch head `41aba47f89414183a3e9055362f1faf818428cde`, on the current activation baseline `master@6d38208741d186988468ec92b632dd3669a03aa5`. Its bounded production repair is `ResourceLease.cpu <= 1 -> Parallelism::Serial`; a larger admitted grant maps to `Parallelism::RayonNewPool(admitted_cpu_parallelism)`. Serial traversal stays on the scanner worker carrying background QoS; any Rayon pool remains bounded by the WorkScheduler lease. No threshold, Windows capacity, scheduler, durable scan authority or 15-second boundary changes. The candidate production commit and final exact HEAD will be recorded with the hosted observations.

Deterministic scanner tests cover one-CPU serial traversal and a three-CPU grant bounded to a three-thread Rayon pool. Existing scanner cancellation/finalization tests are retained. The existing performance test now emits additional diagnostics only when `background_progressed_after_release` fails: extra scan durable status, original cancelled-run status, scheduler running/queued/background grants, total-grant counts before/at the 15-second boundary, replacement queued/running state and a scan progress marker.

The candidate adds deterministic coarse startup checkpoints only under `native-qa`, including process entry, Tauri setup, database readiness, runtime owners, tray, autostart, hotkey, watcher, macOS lifecycle and setup completion. Checkpoint values contain no path or user data. The optional bounded macOS LLDB batch targets `objc_exception_throw` and `__rust_foreign_exception`, keeps qualification non-blocking when unavailable, and reports `DIAGNOSTIC AVAILABLE` only when a backtrace is captured. Startup checkpoints and exact locked dependency versions are evidence for attribution; no upstream or Zen cause is declared before those results.

Browser-only qualification remains production-code-free and is configured for five independent runs on each OS at both existing viewports. Each run retains separate Preview and Browse result JSON plus raw logs. Preview rows require all nine scenarios at both viewports, twenty raw shell samples and twenty raw useful samples; Browse rows require both viewports and twenty raw samples. Missing or incomplete observations classify as blocked. Hosted repeats have not yet run on the repaired candidate; no post-repair timing result or artifact identity is claimed here.

The post-repair Windows gate remains one full Workspace Foundation managed-scan observation plus three independent observations. Every observation must remain structural HARD PASS and meet pressure p95 <= 2x idle p95. If any misses, production changes stop and the 1–4 effective-slot causal matrix is required before proposing further production work. macOS startup aborts remain unresolved until exact checkpoint/version evidence exists. PR #269 remains Draft, no merge or AI Semantic Authority work is performed, and this record does not claim owner acceptance.

Accepted scope remains existing Global Index, File Library Query V2, Browse/Preview/Read Gate and production WorkScheduler. No compatibility authority is added. No production architecture decision/ADR, schema/provider/runtime migration or product tuning is made. Acceptance remains incomplete wherever resident execution, real/native presentation timing, resource attribution, target review or local hygiene is unresolved; green CI is supporting integration evidence only.
