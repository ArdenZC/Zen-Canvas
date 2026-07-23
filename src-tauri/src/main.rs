#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::io;

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
use zen_canvas_tauri::{
    dedupe::DedupeJobManager,
    open_database, settings,
    watcher::{reload_file_watcher_for_settings, FileWatcherManager},
    AIClassificationCancellationToken, OperationCancellationToken, ScanJobManager,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let db = open_database(app.handle()).map_err(io::Error::other)?;
            zen_canvas_tauri::file_ops::reconcile_pending_operation_journal(&db)
                .map_err(io::Error::other)?;
            zen_canvas_tauri::storage_analyzer::reconcile_pending_cleanup_journal(&db)
                .map_err(io::Error::other)?;
            app.manage(db.clone());
            app.manage(ScanJobManager::default());
            app.manage(DedupeJobManager::default());
            app.manage(OperationCancellationToken::default());
            app.manage(AIClassificationCancellationToken::default());
            app.manage(FileWatcherManager::default());
            app.manage(zen_canvas_tauri::storage_analyzer::StorageCleanupState::default());
            app.manage(zen_canvas_tauri::storage_analyzer::CleanupRestoreState::default());
            app.manage(zen_canvas_tauri::app_control::GlobalHotkeyStatusState::default());
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
            let watcher_manager = app.state::<FileWatcherManager>();
            if let Err(error) = reload_file_watcher_for_settings(
                app.handle().clone(),
                &watcher_manager,
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
            zen_canvas_tauri::app_control::get_global_hotkey_status,
            zen_canvas_tauri::app_control::register_global_search_hotkey,
            zen_canvas_tauri::scanner::scan_directory,
            zen_canvas_tauri::scanner::create_scan_job_id,
            zen_canvas_tauri::scanner::cancel_scan,
            zen_canvas_tauri::dedupe::cancel_dedupe,
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
            zen_canvas_tauri::storage_analyzer::move_cleanup_candidates_to_trash,
            zen_canvas_tauri::storage_analyzer::move_cleanup_candidates_to_safe_trash,
            zen_canvas_tauri::storage_analyzer::list_cleanup_trash_batches,
            zen_canvas_tauri::storage_analyzer::preview_restore_cleanup_trash,
            zen_canvas_tauri::storage_analyzer::restore_cleanup_trash_items,
            zen_canvas_tauri::storage_analyzer::cancel_cleanup_restore
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Zen Canvas");
}
