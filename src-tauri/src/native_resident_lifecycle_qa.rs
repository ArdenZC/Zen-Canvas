//! Opt-in Windows regression using the production resident owners and commands.
//! No mock runtime, synthetic exit request, readiness bypass, or timed polling.
use crate::{app_control::*, db::Database, watcher::FileWatcherManager};
use std::{
    collections::VecDeque,
    fs::OpenOptions,
    io::Write,
    sync::{Arc, Condvar, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Listener, Manager};

#[derive(Default)]
struct Ledger {
    events: VecDeque<String>,
    finished: bool,
    shutdowns: [usize; 3],
}
#[derive(Clone, Default)]
pub struct ResidentLifecycleQa(Arc<(Mutex<Ledger>, Condvar)>);

pub fn observe<R: tauri::Runtime>(app: &AppHandle<R>, stage: &str) {
    let Some(qa) = app.try_state::<ResidentLifecycleQa>() else {
        return;
    };
    let (lock, changed) = &*qa.0;
    let mut ledger = lock.lock().unwrap();
    match stage {
        "automation_shutdown" => ledger.shutdowns[0] += 1,
        "global_index_shutdown" => ledger.shutdowns[1] += 1,
        "managed_ai_shutdown" => ledger.shutdowns[2] += 1,
        "run_event_exit" => {
            if ledger.finished && ledger.shutdowns == [1, 1, 1] {
                eprintln!(
                    "native_qa resident_regression PASS shutdowns=1,1,1 normal_tauri_exit=true"
                );
            } else {
                eprintln!(
                    "native_qa resident_regression FAIL unexpected_exit shutdowns={:?}",
                    ledger.shutdowns
                );
            }
        }
        _ => {}
    }
    if ledger.events.len() < 256 {
        ledger.events.push_back(if stage == "main_ready" {
            format!(
                "main_ready:{}",
                app.state::<MainWindowLifecycleState>()
                    .latest_generation()
                    .unwrap_or(0)
            )
        } else {
            stage.into()
        });
    }
    changed.notify_all();
}

impl ResidentLifecycleQa {
    fn wait(&self, stage: &str, deadline: Instant) -> Result<(), String> {
        let (lock, changed) = &*self.0;
        let mut ledger = lock.lock().unwrap();
        loop {
            if let Some(index) = ledger.events.iter().position(|event| event == stage) {
                ledger.events.remove(index);
                return Ok(());
            }
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(format!("deadline_waiting_for:{stage}"));
            }
            ledger = changed.wait_timeout(ledger, remaining).unwrap().0;
        }
    }
    fn assert_resident(&self, app: &AppHandle, owners: &[usize; 5]) -> Result<(), String> {
        if !app.webview_windows().is_empty()
            || app
                .state::<crate::file_workspace::integration::FileWorkspaceRuntimeOwner>()
                .current_generation()
                .is_some()
            || self.0 .0.lock().unwrap().shutdowns != [0, 0, 0]
            || resident_owners(app) != *owners
        {
            return Err("resident_owner_or_zero_webview_invariant".into());
        }
        trace_resident_lifecycle(
            app,
            "resident_verified",
            "owners_unchanged=true workspace_disposed=true shutdowns=0,0,0",
        );
        Ok(())
    }
}

fn resident_owners(app: &AppHandle) -> [usize; 5] {
    [
        app.state::<Database>().inner() as *const _ as usize,
        app.state::<FileWatcherManager>().inner() as *const _ as usize,
        app.state::<crate::db::AutomationTriggerCoordinator>()
            .inner() as *const _ as usize,
        app.state::<crate::global_index::GlobalIndexCoordinator>()
            .inner() as *const _ as usize,
        Arc::as_ptr(&crate::scheduler::WorkScheduler::global()) as usize,
    ]
}

pub fn install(app: &AppHandle) -> Result<(), String> {
    let Ok(mode) = std::env::var("ZC_NATIVE_QA_RESIDENT_LIFECYCLE") else {
        return Ok(());
    };
    if !matches!(mode.as_str(), "background" | "visible_quit") {
        return Err("invalid_resident_qa_mode".into());
    }
    let root = std::path::PathBuf::from(
        std::env::var_os("ZC_NATIVE_QA_PROFILE_ROOT")
            .ok_or("resident_qa_requires_isolated_profile")?,
    );
    if !root.is_absolute()
        || !app
            .state::<Database>()
            .list_automation_intents()
            .map_err(|e| e.to_string())?
            .is_empty()
    {
        return Err("resident_qa_requires_fresh_profile".into());
    }
    let qa = ResidentLifecycleQa::default();
    app.manage(qa.clone());
    for event in ["watcher-reconciliation-status", "automation-updated"] {
        let handle = app.clone();
        app.listen(event, move |_| observe(&handle, "projection_changed"));
    }
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(error) = run(&app, &qa, &mode, &root) {
            eprintln!("native_qa resident_regression FAIL {error}");
            app.state::<crate::exit_intent::ExitIntentState>()
                .record_explicit_exit();
            app.exit(1);
        }
    });
    Ok(())
}

fn run(
    app: &AppHandle,
    qa: &ResidentLifecycleQa,
    mode: &str,
    profile: &std::path::Path,
) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(90);
    qa.wait("main_ready:1", deadline)?;
    let owners = resident_owners(app);
    let initial_pid = std::process::id();
    if mode == "visible_quit" {
        qa.0 .0.lock().unwrap().finished = true;
        quit_app(
            app.get_webview_window("main").ok_or("main_missing")?,
            app.clone(),
        )?;
        return Ok(());
    }
    let fixture = profile.join("resident-fixture");
    std::fs::create_dir(&fixture).map_err(|e| e.to_string())?;
    let file = fixture.join("event.txt");
    std::fs::write(&file, b"native lifecycle fixture\n").map_err(|e| e.to_string())?;
    let db = app.state::<Database>();
    let mut settings = crate::settings::get_app_settings(&db).map_err(|e| e.to_string())?;
    settings.default_scan_folders = vec![crate::settings::ScanRootSetting {
        id: "resident-lifecycle-fixture".into(),
        path: fixture.to_string_lossy().into(),
        label: "Resident lifecycle fixture".into(),
        enabled: true,
        created_at: "2026-10-02T00:00:00Z".into(),
    }];
    crate::settings::save_app_settings(&db, &settings).map_err(|e| e.to_string())?;
    crate::watcher::reload_file_watcher_for_settings(
        app.clone(),
        &app.state::<FileWatcherManager>(),
        &db,
        &app.state::<crate::scanner::ScanJobManager>(),
        &app.state::<crate::dedupe::DedupeJobManager>(),
        &settings,
    )?;
    let before = loop {
        let root = db
            .get_scan_root_health(None, Some(&fixture.to_string_lossy()))
            .map_err(|e| e.to_string())?;
        if root.health_status == "healthy"
            && !root.needs_reconciliation
            && root.watcher_revision == root.watcher_applied_revision
        {
            break root;
        }
        qa.wait("projection_changed", deadline)?;
    };
    let library_before = library_revision(&db, &before.id)?;
    let intent = db
        .create_automation_intent(
            serde_json::from_value(serde_json::json!({
                "title":"Resident lifecycle regression", "workflowKind":"organize_plan",
                "scopeQuery":{"scope":{"kind":"roots","scanRootIds":[before.id]}},
                "trigger":{"version":2,"kind":"managed_scope_change"},
                "policy":{"version":1,"review":"required","autoExecute":false},"enabled":true
            }))
            .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    for cycle in 1..=2 {
        let generation = app
            .state::<MainWindowLifecycleState>()
            .latest_generation()?;
        if app.webview_windows().len() != 1 {
            return Err("main_must_be_last_webview".into());
        }
        enter_background(
            app.get_webview_window("main").ok_or("main_missing")?,
            app.state(),
            app.state(),
            app.state(),
            app.state(),
            app.clone(),
            SearchView::Scanner,
        )?;
        qa.wait("exit_prevented", deadline)?;
        qa.assert_resident(app, &owners)?;
        if cycle == 1 {
            let appended = Instant::now();
            OpenOptions::new()
                .append(true)
                .open(&file)
                .and_then(|mut file| file.write_all(b"background append\n"))
                .map_err(|e| e.to_string())?;
            loop {
                let after = db
                    .get_scan_root_health(Some(&before.id), None)
                    .map_err(|e| e.to_string())?;
                let library_after = library_revision(&db, &before.id)?;
                let runs = db
                    .list_automation_runs(Some(&intent.id))
                    .map_err(|e| e.to_string())?;
                if let Some(run) = runs.first() {
                    if after.watcher_revision <= before.watcher_revision
                        || after.watcher_revision != after.watcher_applied_revision
                        || library_after <= library_before
                        || runs.len() != 1
                        || run.result_plan_id.is_none()
                        || appended.elapsed() < Duration::from_secs(5)
                    {
                        return Err("background_publication_or_settle_invariant".into());
                    }
                    qa.assert_resident(app, &owners)?;
                    trace_resident_lifecycle(app, "background_delivery_verified", &format!("watcher_before={} watcher_after={} applied={} library_before={} library_after={} elapsed_ms={} runs=1 plans=1",before.watcher_revision,after.watcher_revision,after.watcher_applied_revision,library_before,library_after,appended.elapsed().as_millis()));
                    break;
                }
                qa.wait("projection_changed", deadline)?;
            }
            // The same owner called by the tray menu; no second runtime or process.
            show_main_window(app)?;
            qa.wait(&format!("main_ready:{}", generation + 1), deadline)?;
            if app
                .state::<MainWindowLifecycleState>()
                .latest_generation()?
                <= generation
                || std::process::id() != initial_pid
                || resident_owners(app) != owners
            {
                return Err("reopen_generation_or_owner_invariant".into());
            }
            trace_resident_lifecycle(
                app,
                "reopen_verified",
                "same_pid=true fresh_generation=true readiness=true owners_unchanged=true",
            );
        }
    }
    let operations: i64 = db.conn().map_err(|e| e.to_string())?.query_row(
        "SELECT (SELECT count(*) FROM operation_logs) + (SELECT count(*) FROM cleanup_trash_items)",
        [], |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if operations != 0
        || std::fs::read(&file).map_err(|e| e.to_string())?
            != b"native lifecycle fixture\nbackground append\n"
        || std::fs::read_dir(&fixture)
            .map_err(|e| e.to_string())?
            .count()
            != 1
    {
        return Err("automatic_filesystem_mutation_invariant".into());
    }
    trace_resident_lifecycle(
        app,
        "filesystem_manifest_verified",
        "manual_appends=1 automatic_mutations=0 files=1",
    );
    qa.0 .0.lock().unwrap().finished = true;
    // Same explicit Quit owner as the tray menu, while no WebViews exist.
    exit_app(app);
    Ok(())
}

fn library_revision(db: &Database, root: &str) -> Result<i64, String> {
    db.conn()
        .map_err(|e| e.to_string())?
        .query_row(
            "SELECT library_change_revision FROM scan_roots WHERE id=?1",
            [root],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
}
