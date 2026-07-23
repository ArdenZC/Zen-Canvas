# Tauri command permission matrix

`src-tauri/build.rs` is the single generated AppManifest input. Its `COMMANDS` list must stay byte-for-byte complete with the `tauri::generate_handler!` list in `src-tauri/src/main.rs`. The `default` capability is attached only to `main`; `search-window` receives only the read-only/window-internal subset below.

| Rust command | Category | Window | Side effect | Capability | Internal main-window guard | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `init_db` | `main_state_mutation` | main | Initialize database | default | yes | command permission contract |
| `insert_file` | `main_state_mutation` | main | Write indexed file | default | yes | command permission contract |
| `remove_files_by_paths` | `main_state_mutation` | main | Remove index rows | default | yes | command permission contract |
| `upsert_files_by_paths` | `main_state_mutation` | main | Write index rows | default | yes | command permission contract |
| `search_files` | `read_only` | main/search | Read search index | default/search-window | no | capability allow-list |
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
| `scan_directory` | `main_state_mutation` | main | Start filesystem scan and index writes | default | yes | command permission contract |
| `create_scan_job_id` | `read_only` | main | Create opaque job ID | default | no | command permission contract |
| `cancel_scan` | `main_state_mutation` | main | Cancel scan job | default | yes | command permission contract |
| `cancel_dedupe` | `main_state_mutation` | main | Cancel dedupe job | default | yes | command permission contract |
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
