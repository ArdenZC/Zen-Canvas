# Tauri command permission matrix

`src-tauri/build.rs` is the single generated AppManifest input. Its `COMMANDS` list must stay byte-for-byte complete with the `tauri::generate_handler!` list in `src-tauri/src/main.rs`. The `default` capability is attached only to `main`; `search-window` receives only the read-only/window-internal subset below.

| Rust command | Category | Window | Side effect | Capability | Internal main-window guard | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `init_db` | `main_state_mutation` | main | Initialize database | default | yes | command permission contract |
| `insert_file` | `main_state_mutation` | main | Write indexed file | default | yes | command permission contract |
| `remove_files_by_paths` | `main_state_mutation` | main | Remove index rows | default | yes | command permission contract |
| `upsert_files_by_paths` | `main_state_mutation` | main | Write index rows | default | yes | command permission contract |
| `search_files` | `read_only` | main/search | Read search index | default/search-window | no | capability allow-list |
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
| `get_paged_files` | `read_only` | main/search | Read file library | default/search-window | no | capability allow-list |
| `get_operation_previews_for_scope` | `read_only` | main/search | Read preview data | default/search-window | no | capability allow-list |
| `get_stats_summary` | `read_only` | main/search | Read statistics | default/search-window | no | capability allow-list |
| `get_operation_logs` | `read_only` | main | Read operation history | default | no | command permission contract |
| `get_user_rules` | `read_only` | main | Read rules | default | no | command permission contract |
| `save_user_rule` | `main_state_mutation` | main | Write user rule | default | yes | command permission contract |
| `delete_user_rule` | `main_state_mutation` | main | Delete user rule | default | yes | command permission contract |
| `confirm_classification` | `main_state_mutation` | main | Persist user confirmation | default | yes | command permission contract |
| `correct_classification` | `main_state_mutation` | main | Persist user correction | default | yes | command permission contract |
| `execute_rules_on_inbox` | `main_state_mutation` | main | Apply rules to index | default | yes | command permission contract |
| `execute_rules_for_paths` | `main_state_mutation` | main | Apply rules to paths | default | yes | command permission contract |
| `execute_rules_for_scope` | `main_state_mutation` | main | Apply rules to scope | default | yes | command permission contract |
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
| `activate_search_result` | `window_internal` | search | Navigate main window | default/search-window | no | capability allow-list |
| `resize_search_window` | `window_internal` | search | Resize search window | default/search-window | no | capability allow-list |
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
| `move_cleanup_candidates_to_trash` | `filesystem_mutation` | main | Move to system trash | default | yes | cleanup safety tests |
| `move_cleanup_candidates_to_safe_trash` | `filesystem_mutation` | main | Move to Safe Trash | default | yes | cleanup safety tests |
| `list_cleanup_trash_batches` | `read_only` | main | Read Safe Trash journal | default | no | command permission contract |
| `preview_restore_cleanup_trash` | `read_only` | main | Build restore preview | default | no | restore tests |
| `restore_cleanup_trash_items` | `filesystem_mutation` | main | Restore Safe Trash items | default | yes | restore identity tests |
| `cancel_cleanup_restore` | `main_state_mutation` | main | Cancel restore job | default | yes | command permission contract |

The search capability intentionally contains no settings save, credential, rule write, scan, cleanup, file operation, restore, or debug permission. The runtime check remains defense in depth for mutation commands; capability denial is not treated as the only boundary.
