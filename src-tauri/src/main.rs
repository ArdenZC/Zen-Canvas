#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::io;

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
use zen_canvas_tauri::{
    dedupe::DedupeJobManager,
    global_index::{GlobalIndexCoordinator, ManagedAiWorker},
    open_database, settings,
    watcher::{reload_file_watcher_for_settings, FileWatcherManager},
    AIClassificationCancellationToken, OperationCancellationToken, ScanJobManager,
};

fn main() {
    #[cfg(windows)]
    if std::env::args().any(|argument| argument == "--index-service") {
        std::process::exit(
            zen_canvas_tauri::global_index::windows::service_host::run_index_service_process(),
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let db = open_database(app.handle()).map_err(io::Error::other)?;
            db.recover_dedupe_runs().map_err(io::Error::other)?;
            db.recover_analysis_runs().map_err(io::Error::other)?;
            if let Err(error) = db.prune_analysis_artifacts() {
                eprintln!("Analysis retention prune skipped: {error}");
            }
            if let Err(error) = db.prune_dedupe_artifacts() {
                eprintln!("Dedupe retention prune skipped: {error}");
            }
            zen_canvas_tauri::scanner::recover_scan_state(&db).map_err(io::Error::other)?;
            zen_canvas_tauri::file_ops::reconcile_pending_operation_journal(&db)
                .map_err(io::Error::other)?;
            zen_canvas_tauri::storage_analyzer::reconcile_pending_cleanup_journal(&db)
                .map_err(io::Error::other)?;
            app.manage(db.clone());
            let global_index_coordinator = GlobalIndexCoordinator::new(db.clone());
            app.manage(global_index_coordinator.clone());
            if let Err(error) = global_index_coordinator.start() {
                eprintln!("Global index startup failed (non-fatal): {error}");
            }
            let managed_ai_worker = ManagedAiWorker::start(db.clone());
            app.manage(managed_ai_worker);
            app.manage(ScanJobManager::default());
            let dedupe_jobs = DedupeJobManager::default();
            app.manage(dedupe_jobs.clone());
            app.manage(zen_canvas_tauri::analysis::AnalysisRunManager::default());
            if let Err(error) = zen_canvas_tauri::scanner::resume_pending_dedupe_dispatches(
                app.handle().clone(),
                db.clone(),
                dedupe_jobs,
            ) {
                eprintln!("Dedupe dispatch recovery failed (non-fatal): {error}");
            }
            app.manage(OperationCancellationToken::default());
            app.manage(AIClassificationCancellationToken::default());
            app.manage(FileWatcherManager::default());
            app.manage(zen_canvas_tauri::storage_analyzer::CleanupRestoreState::default());
            app.manage(zen_canvas_tauri::app_control::GlobalHotkeyStatusState::default());
            app.manage(zen_canvas_tauri::app_control::SearchWindowLifecycleState::default());
            app.manage(zen_canvas_tauri::app_control::MainWindowReadinessState::default());
            zen_canvas_tauri::app_control::setup_tray(app).map_err(io::Error::other)?;
            zen_canvas_tauri::app_control::setup_search_window(app).map_err(io::Error::other)?;
            let app_settings = settings::get_app_settings(&db).map_err(io::Error::other)?;
            let launch_at_login = app.autolaunch();
            let app_settings = match settings::sync_launch_at_login_from_system(
                &db,
                &app_settings,
                &*launch_at_login,
            ) {
                Ok(synced_settings) => synced_settings,
                Err(error) => {
                    eprintln!("Launch at login sync failed (non-fatal): {error}");
                    app_settings
                }
            };
            db.prune_operation_logs(app_settings.restore_retention_days)
                .map_err(io::Error::other)?;
            if let Err(error) = zen_canvas_tauri::app_control::setup_global_search_shortcut(
                app,
                &app_settings.search_hotkey,
            ) {
                eprintln!("Global search hotkey setup failed (non-fatal): {error}");
            }
            db.sync_file_library_watcher_roots(&app_settings.default_scan_folders)
                .map_err(io::Error::other)?;
            let watcher_manager = app.state::<FileWatcherManager>();
            if zen_canvas_tauri::watcher::backend_watcher_reconciliation_enabled() {
                if let Err(error) = zen_canvas_tauri::watcher::recover_watcher_reconciliation_state(
                    app.handle().clone(),
                    db.clone(),
                ) {
                    eprintln!("Watcher reconciliation recovery failed (non-fatal): {error}");
                }
            }
            if let Err(error) = reload_file_watcher_for_settings(
                app.handle().clone(),
                &watcher_manager,
                &db,
                app.state::<ScanJobManager>().inner(),
                app.state::<DedupeJobManager>().inner(),
                &app_settings,
            ) {
                eprintln!("File watcher init failed (non-fatal): {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            zen_canvas_tauri::db::init_db,
            zen_canvas_tauri::db::insert_file,
            zen_canvas_tauri::db::remove_files_by_paths,
            zen_canvas_tauri::db::upsert_files_by_paths,
            zen_canvas_tauri::db::search_files,
            zen_canvas_tauri::global_index::commands::search_global_entries,
            zen_canvas_tauri::global_index::commands::get_global_index_status,
            zen_canvas_tauri::global_index::commands::list_global_index_sources,
            zen_canvas_tauri::global_index::commands::start_global_index,
            zen_canvas_tauri::global_index::commands::pause_global_index,
            zen_canvas_tauri::global_index::commands::resume_global_index,
            zen_canvas_tauri::global_index::commands::rebuild_global_index_source,
            zen_canvas_tauri::global_index::commands::set_global_index_source_enabled,
            zen_canvas_tauri::global_index::commands::open_global_search_result,
            zen_canvas_tauri::global_index::commands::reveal_global_search_result,
            zen_canvas_tauri::global_index::commands::list_managed_scopes,
            zen_canvas_tauri::global_index::commands::add_managed_scope,
            zen_canvas_tauri::global_index::commands::remove_managed_scope,
            zen_canvas_tauri::global_index::commands::update_managed_scope_policy,
            zen_canvas_tauri::global_index::commands::get_ai_management_status,
            zen_canvas_tauri::db::get_paged_files,
            zen_canvas_tauri::db::get_operation_previews_for_scope,
            zen_canvas_tauri::db::get_stats_summary,
            zen_canvas_tauri::db::get_operation_logs,
            zen_canvas_tauri::db::get_user_rules,
            zen_canvas_tauri::db::save_user_rule,
            zen_canvas_tauri::db::delete_user_rule,
            zen_canvas_tauri::db::confirm_classification,
            zen_canvas_tauri::db::correct_classification,
            zen_canvas_tauri::db::execute_rules_on_inbox,
            zen_canvas_tauri::db::execute_rules_for_paths,
            zen_canvas_tauri::db::execute_rules_for_scope,
            zen_canvas_tauri::settings::get_settings,
            zen_canvas_tauri::settings::save_settings,
            zen_canvas_tauri::ai::settings::get_ai_settings,
            zen_canvas_tauri::ai::settings::save_ai_settings,
            zen_canvas_tauri::ai::settings::list_ai_provider_presets,
            zen_canvas_tauri::ai::settings::list_ai_models,
            zen_canvas_tauri::ai::settings::test_ai_provider_connection,
            zen_canvas_tauri::ai::trace::list_ai_request_traces,
            zen_canvas_tauri::ai::trace::clear_ai_request_traces,
            zen_canvas_tauri::ai::trace::export_ai_request_traces,
            zen_canvas_tauri::ai::classification::classify_files_with_ai,
            zen_canvas_tauri::ai::classification::classify_selected_files_with_ai,
            zen_canvas_tauri::ai::classification::cancel_ai_classification,
            zen_canvas_tauri::ai::debug::debug_ai_classification_once,
            zen_canvas_tauri::runtime_capabilities::get_runtime_capabilities,
            zen_canvas_tauri::ai::cleanup::analyze_cleanup_candidates_with_ai,
            zen_canvas_tauri::app_control::quit_app,
            zen_canvas_tauri::app_control::activate_search_result,
            zen_canvas_tauri::app_control::resize_search_window,
            zen_canvas_tauri::app_control::get_search_window_state,
            zen_canvas_tauri::app_control::search_window_ready,
            zen_canvas_tauri::app_control::hide_search_window_command,
            zen_canvas_tauri::app_control::mark_main_window_ready,
            zen_canvas_tauri::app_control::acknowledge_main_window_ready,
            zen_canvas_tauri::app_control::get_global_hotkey_status,
            zen_canvas_tauri::app_control::register_global_search_hotkey,
            zen_canvas_tauri::scanner::start_managed_scan,
            zen_canvas_tauri::scanner::cancel_scan_run,
            zen_canvas_tauri::scanner::get_managed_scan_snapshot,
            zen_canvas_tauri::scanner::get_scan_run,
            zen_canvas_tauri::scanner::list_scan_runs,
            zen_canvas_tauri::scanner::list_scan_roots,
            zen_canvas_tauri::scanner::get_scan_root_health,
            zen_canvas_tauri::scanner::retry_interrupted_scan,
            zen_canvas_tauri::scanner::scan_directory,
            zen_canvas_tauri::scanner::create_scan_job_id,
            zen_canvas_tauri::scanner::cancel_scan,
            zen_canvas_tauri::dedupe::cancel_dedupe,
            zen_canvas_tauri::dedupe::start_dedupe_run,
            zen_canvas_tauri::dedupe::retry_dedupe_run,
            zen_canvas_tauri::dedupe::cancel_dedupe_run,
            zen_canvas_tauri::dedupe::get_dedupe_run,
            zen_canvas_tauri::dedupe::list_dedupe_runs,
            zen_canvas_tauri::dedupe::get_active_dedupe_run,
            zen_canvas_tauri::dedupe::list_duplicate_groups,
            zen_canvas_tauri::dedupe::get_duplicate_group,
            zen_canvas_tauri::dedupe::list_duplicate_group_members,
            zen_canvas_tauri::dedupe::get_file_duplicate_membership,
            zen_canvas_tauri::analysis::list_analysis_detectors,
            zen_canvas_tauri::analysis::start_analysis_run,
            zen_canvas_tauri::analysis::cancel_analysis_run,
            zen_canvas_tauri::analysis::retry_analysis_run,
            zen_canvas_tauri::analysis::get_analysis_run,
            zen_canvas_tauri::analysis::get_active_analysis_run,
            zen_canvas_tauri::analysis::list_analysis_runs,
            zen_canvas_tauri::analysis::list_analysis_run_detectors,
            zen_canvas_tauri::analysis::list_analysis_findings,
            zen_canvas_tauri::analysis::get_analysis_finding,
            zen_canvas_tauri::analysis::list_analysis_finding_evidence,
            zen_canvas_tauri::analysis::get_dedupe_authority,
            zen_canvas_tauri::analysis::set_analysis_finding_decision,
            zen_canvas_tauri::analysis::revalidate_analysis_finding,
            zen_canvas_tauri::file_ops::reveal_in_folder,
            zen_canvas_tauri::file_ops::execute_moves,
            zen_canvas_tauri::file_ops::restore_moves,
            zen_canvas_tauri::file_ops::cancel_operations,
            zen_canvas_tauri::storage_analyzer::start_storage_cleanup_scan,
            zen_canvas_tauri::storage_analyzer::get_storage_cleanup_scan_status,
            zen_canvas_tauri::storage_analyzer::get_storage_cleanup_candidate_page,
            zen_canvas_tauri::storage_analyzer::cancel_storage_cleanup_scan,
            zen_canvas_tauri::storage_analyzer::reveal_storage_candidate,
            zen_canvas_tauri::storage_analyzer::preview_cleanup_candidates,
            zen_canvas_tauri::storage_analyzer::preview_cleanup_operations,
            zen_canvas_tauri::storage_analyzer::move_cleanup_candidates_to_safe_trash,
            zen_canvas_tauri::storage_analyzer::list_cleanup_trash_batches,
            zen_canvas_tauri::storage_analyzer::preview_restore_cleanup_trash,
            zen_canvas_tauri::storage_analyzer::restore_cleanup_trash_items,
            zen_canvas_tauri::storage_analyzer::cancel_cleanup_restore
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Zen Canvas")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::ExitRequested { .. }) {
                if let Some(coordinator) = app.try_state::<GlobalIndexCoordinator>() {
                    if let Err(error) = coordinator.shutdown() {
                        eprintln!("Global index shutdown failed (non-fatal): {error}");
                    }
                }
                if let Some(worker) = app.try_state::<ManagedAiWorker>() {
                    worker.shutdown();
                }
            }
        });
}
