# Tauri command permission matrix

`src-tauri/build.rs` is the single generated AppManifest input. Its `COMMANDS` list must stay byte-for-byte complete with the `tauri::generate_handler!` list in `src-tauri/src/main.rs`. The `default` capability is attached only to `main`; `search-window` receives only the read-only/window-internal subset below.

| Rust command | Category | Window | Side effect | Capability | Internal main-window guard | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `init_db` | `main_state_mutation` | main | Initialize database | default | yes | command permission contract |
| `insert_file` | `main_state_mutation` | main | Write indexed file | default | yes | command permission contract |
| `remove_files_by_paths` | `main_state_mutation` | main | Remove index rows | default | yes | command permission contract |
| `upsert_files_by_paths` | `main_state_mutation` | main | Write index rows | default | yes | command permission contract |
| `search_files` | `read_only` | main | Read File Library index | default | no | capability allow-list |
| `search_global_entries` | `read_only` | main/search | Read the independent global metadata index | default/search-window | no | global index isolation tests |
| `get_global_index_status` | `read_only` | main | Read global index status | default | no | global index status tests |
| `list_global_index_sources` | `read_only` | main | Read discovered index sources | default | no | global index source tests |
| `start_global_index` | `main_state_mutation` | main | Start global indexing | default | yes | command permission contract |
| `pause_global_index` | `main_state_mutation` | main | Pause global indexing | default | yes | command permission contract |
| `resume_global_index` | `main_state_mutation` | main | Resume global indexing | default | yes | command permission contract |
| `rebuild_global_index_source` | `main_state_mutation` | main | Rebuild one global index source | default | yes | command permission contract |
| `set_global_index_source_enabled` | `main_state_mutation` | main | Enable or disable one global index source | default | yes | command permission contract |
| `open_global_search_result` | `read_only` | main/search | Open a global search result | default/search-window | no | global search navigation tests |
| `reveal_global_search_result` | `read_only` | main/search | Reveal a global search result | default/search-window | no | global search navigation tests |
| `list_managed_scopes` | `read_only` | main | Read AI-managed scopes | default | no | managed scope isolation tests |
| `add_managed_scope` | `main_state_mutation` | main | Add an explicit AI-managed scope | default | yes | managed scope isolation tests |
| `remove_managed_scope` | `main_state_mutation` | main | Remove an AI-managed scope | default | yes | managed scope isolation tests |
| `update_managed_scope_policy` | `main_state_mutation` | main | Update AI processing policy for a scope | default | yes | managed scope isolation tests |
| `get_ai_management_status` | `read_only` | main | Read AI-managed queue status | default | no | managed scope isolation tests |
| `get_paged_files` | `read_only` | main | Read file library | default | no | capability allow-list |
| `query_file_library_v2` | `read_only` | main | Read the durable File Library query snapshot | default | no | File Library V2 query tests |
| `resolve_file_library_exact_count_v2` | `read_only` | main | Resolve a deferred exact count bound to the canonical query snapshot | default | no | File Library V2 deferred-count tests |
| `get_file_library_detail` | `read_only` | main | Read metadata-only detail by durable file ID | default | no | File Library V2 detail tests |
| `get_file_library_selection_summary` | `read_only` | main | Summarize an explicit or all-matching File Library selection | default | no | File Library V2 selection tests |
| `reveal_file_library_entry` | `read_only` | main | Reveal a durable file ID after backend path resolution | default | no | File Library V2 reveal tests |
| `list_user_tags` | `read_only` | main | Read durable File Library user tags | default | no | File Library V2 tag tests |
| `create_user_tag` | `main_state_mutation` | main | Create a durable File Library user tag | default | yes | File Library V2 tag tests |
| `update_user_tag` | `main_state_mutation` | main | Update a durable File Library user tag | default | yes | File Library V2 tag tests |
| `delete_user_tag` | `main_state_mutation` | main | Delete a durable File Library user tag with usage confirmation | default | yes | File Library V2 tag tests |
| `mutate_file_user_tags` | `main_state_mutation` | main | Apply durable user tags to an explicit or all-matching selection | default | yes | File Library V2 selection tests |
| `list_library_saved_views` | `read_only` | main | Read durable File Library Saved Views | default | no | File Library V2 Saved View tests |
| `create_library_saved_view` | `main_state_mutation` | main | Create a canonical durable File Library Saved View | default | yes | File Library V2 Saved View tests |
| `update_library_saved_view` | `main_state_mutation` | main | Update a canonical durable File Library Saved View with CAS | default | yes | File Library V2 Saved View tests |
| `delete_library_saved_view` | `main_state_mutation` | main | Delete a durable File Library Saved View with CAS | default | yes | File Library V2 Saved View tests |
| `create_organization_plan` | `main_state_mutation` | main | Atomically materialize an ID-only File Library selection into a durable review plan | default | yes | organization plan materialization tests |
| `list_organization_plans` | `read_only` | main | List durable organization plan summaries | default | no | organization plan query tests |
| `get_organization_plan` | `read_only` | main | Read one durable organization plan summary by ID | default | no | organization plan query tests |
| `query_organization_plan_items` | `read_only` | main | Read organization plan items with a keyset cursor | default | no | organization plan cursor tests |
| `query_organization_plan_groups` | `read_only` | main | Read complete backend-derived organization plan group summaries with a keyset cursor | default | no | organization group projection tests |
| `query_organization_plan_group_items` | `read_only` | main | Read one backend-derived organization plan group with a keyset cursor | default | no | organization group cursor tests |
| `update_organization_plan_decisions` | `main_state_mutation` | main | Persist review decisions with plan and item revision CAS | default | yes | organization plan decision tests |
| `update_organization_plan_group_decision` | `main_state_mutation` | main | Resolve a backend-derived group decision with plan revision CAS and existing safe-batch checks | default | yes | organization group decision tests |
| `refresh_organization_plan` | `main_state_mutation` | main | Revalidate plan items against current indexed metadata and previews | default | yes | organization plan refresh tests |
| `cancel_organization_plan` | `main_state_mutation` | main | Cancel a non-terminal plan with revision CAS | default | yes | organization plan state tests |
| `delete_organization_plan` | `main_state_mutation` | main | Delete a confirmed terminal plan with revision CAS | default | yes | organization plan retention tests |
| `analyze_organization_plan_items` | `main_state_mutation` | main | Enqueue bounded managed-scope items on the existing AI queue | default | yes | organization managed-AI adapter tests |
| `get_organization_plan_dry_run` | `read_only` | main | Build a live metadata-only authoritative dry run by plan and item IDs | default | no | organization dry-run tests |
| `execute_organization_plan` | `filesystem_mutation` | main | Execute a confirmed non-stale dry run through the existing operation journal | default | yes | organization execution and recovery tests |
| `get_operation_previews_for_scope` | `read_only` | main | Read preview data | default | no | capability allow-list |
| `get_stats_summary` | `read_only` | main | Read statistics | default | no | capability allow-list |
| `get_operation_logs` | `read_only` | main | Read operation history | default | no | command permission contract |
| `get_rule_catalog_state` | `read_only` | main | Read the monotonic Rule Catalog revision | default | no | Rule Repository V2 CAS tests |
| `list_user_rules_v2` | `read_only` | main | Read canonical user rules with per-rule revision/provenance | default | no | Rule Repository V2 tests |
| `create_user_rule_v2` | `main_state_mutation` | main | Canonicalize a renderer draft and create a backend-ID, default-disabled user rule | default | yes | Rule Repository V2 create/CAS tests |
| `update_user_rule_v2` | `main_state_mutation` | main | Update canonical AST under rule/catalog revision CAS | default | yes | Rule Repository V2 update/CAS tests |
| `set_user_rule_enabled_v2` | `main_state_mutation` | main | Independently enable/disable a user rule under rule/catalog CAS | default | yes | toggle separation tests |
| `delete_user_rule_v2` | `main_state_mutation` | main | Confirmed source=user delete under rule/catalog CAS | default | yes | Rule Repository V2 delete tests |
| `confirm_classification` | `main_state_mutation` | main | Persist user confirmation | default | yes | command permission contract |
| `correct_classification` | `main_state_mutation` | main | Persist user correction | default | yes | command permission contract |
| `execute_rules_for_scope_v2` | `main_state_mutation` | main | Load enabled rules from SQLite and update classification/suggestion metadata in a durable-ID scope | default | yes | backend-authoritative execution tests |
| `get_content_scope_policy` | `read_only` | main | Read the consent policy for one durable File Library root | default | yes | content policy/CAS tests |
| `get_content_catalog_revision` | `read_only` | main | Read the schema34 content catalog revision used by keyset search cursors | default | yes | content catalog/search tests |
| `set_content_scope_policy` | `main_state_mutation` | main | Change one root's content consent and invalidate its artifacts under policy CAS | default | yes | content policy/CAS tests |
| `preview_content` | `read_only` | main | Build a bounded, backend-authoritative content preview from durable scope/selection IDs | default | yes | content preview/privacy tests |
| `start_content_run` | `main_state_mutation` | main | Confirm and materialize a bounded local extraction run; source files remain unchanged | default | yes | content run/identity tests |
| `get_content_run` | `read_only` | main | Read one durable content run by opaque ID | default | yes | content lifecycle tests |
| `list_content_runs` | `read_only` | main | List bounded content run projections | default | yes | content paging tests |
| `cancel_content_run` | `main_state_mutation` | main | Request content run cancellation under run revision CAS | default | yes | content cancellation tests |
| `query_content_run_items` | `read_only` | main | Read content run items with an ordinal keyset cursor | default | yes | content item cursor tests |
| `get_content_artifact` | `read_only` | main | Read bounded content facts by durable file ID | default | yes | artifact identity/privacy tests |
| `query_content_artifacts` | `read_only` | main | Search current managed Content Artifacts with scope IDs and keyset cursor | default | yes | managed content FTS tests |
| `rebuild_content_artifact` | `main_state_mutation` | main | Confirm and rebuild one identity-bound artifact | default | yes | rebuild/stale tests |
| `delete_content_artifact` | `main_state_mutation` | main | Confirmed SQL-only deletion of one artifact/FTS fact, never its source file | default | yes | delete safety tests |
| `purge_content_scope` | `main_state_mutation` | main | Confirmed deletion of content facts/runs for a durable managed scope | default | yes | purge/source safety tests |
| `understand_content_artifacts` | `main_state_mutation` | main | Confirmed, sequential provider understanding for at most 20 current artifacts; payload is bounded text only | default | yes | provider privacy/envelope tests |
| `create_rule_proposal` | `main_state_mutation` | main | Persist a draft, claim one interactive generation owner and store only validated canonical output | default | yes | proposal lifecycle/AI boundary tests |
| `regenerate_rule_proposal` | `main_state_mutation` | main | Regenerate an eligible proposal under revision/target CAS | default | yes | owner/cancel/latest-wins tests |
| `get_rule_proposal` | `read_only` | main | Read one durable proposal by opaque ID | default | yes | lifecycle and Search denial tests |
| `list_rule_proposals` | `read_only` | main | Read a bounded keyset proposal page | default | yes | proposal paging/retention tests |
| `cancel_rule_proposal` | `main_state_mutation` | main | Cancel an eligible proposal and signal its process-local request owner | default | yes | cancel/late-response tests |
| `delete_rule_proposal` | `main_state_mutation` | main | Delete only a confirmed terminal proposal under revision CAS | default | yes | terminal retention tests |
| `replace_rule_proposal_candidate` | `main_state_mutation` | main | Recanonicalize, revalidate and refingerprint a manually edited candidate | default | yes | correction/stale-preview tests |
| `preview_rule_proposal` | `read_only` | main | Compute bounded metadata-only exact/deferred impact in a managed scope | default | yes | impact truthfulness tests |
| `resolve_rule_proposal_exact_impact` | `read_only` | main | Resolve an opaque bound impact token to an exact count | default | yes | token/stale tests |
| `apply_rule_proposal` | `main_state_mutation` | main | Atomically apply an exact, confirmed proposal as a disabled user rule | default | yes | Apply CAS/atomicity/no-file-mutation tests |
| `get_settings` | `read_only` | main/search | Read app settings | default/search-window | no | capability allow-list |
| `save_settings` | `main_state_mutation` | main | Write settings and watcher state | default | yes | command permission contract |
| `get_ai_settings` | `read_only` | main | Read AI metadata | default | no | command permission contract |
| `save_ai_settings` | `credential_mutation` | main | Credential store plus metadata | default | yes | credential transaction tests |
| `list_ai_provider_presets` | `read_only` | main | Read static presets | default | no | command permission contract |
| `list_ai_models` | `read_only` | main | Network request, no persistence | default | no | model discovery tests |
| `test_ai_provider_connection` | `read_only` | main | Network request, no persistence | default | no | redirect tests |
| `list_ai_request_traces` | `read_only` | main | Read in-memory diagnostics | default | no | trace redaction tests |
| `clear_ai_request_traces` | `main_state_mutation` | main | Clear in-memory diagnostics | default | yes | trace lifecycle tests |
| `export_ai_request_traces` | `read_only` | main | Export in-memory diagnostics | default | no | trace redaction tests |
| `classify_files_with_ai` | `main_state_mutation` | main | Write classifications | default | yes | command permission contract |
| `classify_selected_files_with_ai` | `main_state_mutation` | main | Write classifications | default | yes | command permission contract |
| `cancel_ai_classification` | `main_state_mutation` | main | Cancel classification job | default | yes | command permission contract |
| `debug_ai_classification_once` | `debug_only` | main/debug | Debug provider request | default (runtime-gated) | yes | release debug gate |
| `get_runtime_capabilities` | `read_only` | main/search | Read feature flags | default/search-window | no | capability allow-list |
| `analyze_cleanup_candidates_with_ai` | `main_state_mutation` | main | Write cleanup suggestions | default | yes | command permission contract |
| `quit_app` | `window_internal` | main | Quit application | default | yes | command permission contract |
| `activate_search_result` | `window_internal` | search | Navigate main window with fixed view/file/settings target | default/search-window | no | capability allow-list + navigation DTO tests |
| `get_search_window_state` | `read_only` | main/search | Hydrate the Rust-owned search-window lifecycle projection | default/search-window | no | lifecycle CAS tests |
| `search_window_ready` | `window_internal` | search | Complete the current showing transition with session/revision CAS | search-window | no | lifecycle CAS tests |
| `resize_search_window` | `window_internal` | search | Serialize session/revision CAS, native resize/center, and revision commit under one Rust operation owner | default/search-window | no | lifecycle CAS/race tests |
| `hide_search_window_command` | `window_internal` | search | Hide search window with session/revision CAS and retryable native-failure rollback | search-window | no | lifecycle CAS/failure tests |
| `mark_main_window_ready` | `window_internal` | main | Publish main renderer readiness | default | yes | navigation readiness tests |
| `acknowledge_main_window_ready` | `window_internal` | main | Acknowledge a Rust-issued navigation readiness nonce | default | yes | navigation readiness tests |
| `get_global_hotkey_status` | `read_only` | main | Read hotkey status | default | no | command permission contract |
| `register_global_search_hotkey` | `main_state_mutation` | main | Register global shortcut | default | yes | command permission contract |
| `start_managed_scan` | `main_state_mutation` | main | Start durable File Library scan session | default | yes | command permission contract |
| `cancel_scan_run` | `main_state_mutation` | main | Request durable scan run cancellation | default | yes | command permission contract |
| `get_managed_scan_snapshot` | `read_only` | main | Read durable scan session mappings and runs | default | no | command permission contract |
| `get_scan_run` | `read_only` | main | Read durable scan run projection | default | no | command permission contract |
| `list_scan_runs` | `read_only` | main | List durable scan run projections | default | no | command permission contract |
| `list_scan_roots` | `read_only` | main | List durable File Library roots | default | no | command permission contract |
| `get_scan_root_health` | `read_only` | main | Read durable scan root health | default | no | command permission contract |
| `retry_interrupted_scan` | `main_state_mutation` | main | Create a new generation for an interrupted scan | default | yes | command permission contract |
| `scan_directory` | `main_state_mutation` | main | Start filesystem scan and index writes | default | yes | command permission contract |
| `create_scan_job_id` | `read_only` | main | Create opaque job ID | default | no | command permission contract |
| `cancel_scan` | `main_state_mutation` | main | Cancel scan job | default | yes | command permission contract |
| `cancel_dedupe` | `main_state_mutation` | main | Cancel dedupe job | default | yes | command permission contract |
| `start_dedupe_run` | `main_state_mutation` | main | Admit and start a durable managed-scope duplicate run | default | yes | durable dedupe admission tests |
| `retry_dedupe_run` | `main_state_mutation` | main | Create a new attempt for a terminal durable duplicate run | default | yes | durable retry/restart tests |
| `cancel_dedupe_run` | `main_state_mutation` | main | Request cancellation of a durable duplicate run | default | yes | durable cancellation tests |
| `get_dedupe_run` | `read_only` | main | Read one durable duplicate run | default | no | durable dedupe query tests |
| `list_dedupe_runs` | `read_only` | main | List durable duplicate runs | default | no | durable dedupe query tests |
| `get_active_dedupe_run` | `read_only` | main | Read the active durable duplicate run | default | no | durable admission tests |
| `list_duplicate_groups` | `read_only` | main | Read active duplicate groups with a keyset cursor | default | no | duplicate group cursor tests |
| `get_duplicate_group` | `read_only` | main | Read one duplicate group | default | no | duplicate group query tests |
| `list_duplicate_group_members` | `read_only` | main | Read the members of one duplicate group | default | no | duplicate group query tests |
| `get_file_duplicate_membership` | `read_only` | main | Read duplicate groups containing one file | default | no | duplicate membership query tests |
| `list_analysis_detectors` | `read_only` | main | Read the fixed analysis detector registry | default | no | analysis contract tests |
| `start_analysis_run` | `main_state_mutation` | main | Admit and start a durable analysis run | default | yes | analysis admission tests |
| `cancel_analysis_run` | `main_state_mutation` | main | Request durable analysis cancellation | default | yes | analysis cancellation tests |
| `retry_analysis_run` | `main_state_mutation` | main | Create a new analysis request attempt | default | yes | analysis retry tests |
| `get_analysis_run` | `read_only` | main | Read one durable analysis run | default | no | analysis query tests |
| `get_active_analysis_run` | `read_only` | main | Read the active analysis run | default | no | analysis admission tests |
| `list_analysis_runs` | `read_only` | main | List durable analysis run history | default | no | analysis query tests |
| `list_analysis_run_detectors` | `read_only` | main | Read detector progress for a run | default | no | detector lifecycle tests |
| `list_analysis_findings` | `read_only` | main | Read typed findings with a keyset cursor | default | no | finding cursor tests |
| `get_analysis_finding` | `read_only` | main | Read one finding and its decision projection | default | no | finding detail tests |
| `list_analysis_finding_evidence` | `read_only` | main | Read typed finding evidence | default | no | evidence tests |
| `get_dedupe_authority` | `read_only` | main | Read the global duplicate authority watermark | default | no | authority tests |
| `set_analysis_finding_decision` | `main_state_mutation` | main | Persist a triage decision with CAS | default | yes | decision tests |
| `revalidate_analysis_finding` | `main_state_mutation` | main | Revalidate a finding identity and stale state | default | yes | cleanup safety tests |
| `reveal_in_folder` | `read_only` | main | Open containing folder | default | no | command permission contract |
| `execute_moves` | `filesystem_mutation` | main | Move/rename files | default | yes | filesystem safety tests |
| `restore_moves` | `filesystem_mutation` | main | Restore files | default | yes | identity/restore tests |
| `cancel_operations` | `main_state_mutation` | main | Cancel file operation job | default | yes | command permission contract |
| `start_storage_cleanup_scan` | `main_state_mutation` | main | Start cleanup analysis | default | yes | cleanup state tests |
| `get_storage_cleanup_scan_status` | `read_only` | main | Read cleanup status | default | no | capability allow-list |
| `get_storage_cleanup_candidate_page` | `read_only` | main | Read cleanup candidates | default | no | capability allow-list |
| `cancel_storage_cleanup_scan` | `main_state_mutation` | main | Cancel cleanup scan | default | yes | cleanup cancel tests |
| `reveal_storage_candidate` | `read_only` | main | Open candidate folder | default | no | command permission contract |
| `preview_cleanup_candidates` | `read_only` | main | Build cleanup preview | default | no | preview tests |
| `preview_cleanup_operations` | `read_only` | main | Build operation preview | default | no | preview tests |
| `move_cleanup_candidates_to_safe_trash` | `filesystem_mutation` | main | Move to Safe Trash | default | yes | cleanup safety tests |
| `list_cleanup_trash_batches` | `read_only` | main | Read Safe Trash journal | default | no | command permission contract |
| `preview_restore_cleanup_trash` | `read_only` | main | Build restore preview | default | no | restore tests |
| `restore_cleanup_trash_items` | `filesystem_mutation` | main | Restore Safe Trash items | default | yes | restore identity tests |
| `cancel_cleanup_restore` | `main_state_mutation` | main | Cancel restore job | default | yes | command permission contract |

The search capability intentionally contains no settings save, credential, rule write, scan, cleanup, file operation, restore, or debug permission. The runtime check remains defense in depth for mutation commands; capability denial is not treated as the only boundary.

## Search navigation DTO boundary

`activate_search_result` accepts `sessionId`, `expectedRevision`, `view`, `fileId`, and an optional `settingsTarget`. The target is a Rust-deserialized fixed enum (`search-scope`, `global-index`, `appearance`, or `ai`); arbitrary DOM selectors, paths, command IDs, and native commands are rejected. The emitted `search-main-ready-request` and `search-navigate` payloads carry the nonce plus the optional session/revision context and the same fixed target. The main renderer applies it only when nonce, session, revision, view, and selection/file context still match the readiness snapshot; an illegal target, view/file combination, or stale context fails closed.

The browser mock validates the same target field but performs no native window or navigation mutation. Search-window resize/show/hide native side effects are serialized by one Rust lifecycle operation owner, and a native failure restores the prior durable phase for retry.
