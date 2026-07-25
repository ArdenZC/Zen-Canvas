from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


managed_scope = "src-tauri/src/global_index/managed_scope.rs"
replace_once(
    managed_scope,
    "use rusqlite::{params, OptionalExtension, Transaction};\n",
    "use rusqlite::{params, OptionalExtension, Transaction};\n\nconst INITIAL_MANAGED_AI_JOB_LIMIT: usize = 100;\n",
)
replace_once(
    managed_scope,
    """    let mut last_id = String::new();
    loop {
""",
    """    let mut last_id = String::new();
    let mut remaining_initial_jobs = if scope.enabled
        && (scope.allow_local_ai || scope.allow_cloud_ai)
    {
        INITIAL_MANAGED_AI_JOB_LIMIT
    } else {
        0
    };
    loop {
""",
)
replace_once(
    managed_scope,
    """        for (entry, entry_id) in &entries {
            upsert_managed_entry(&transaction, &scope.id, entry_id, scope.enabled, now)?;
            enqueue_ai_jobs_for_entry_with_scopes(&transaction, entry_id, entry, &policies)?;
        }
""",
    """        for (entry, entry_id) in &entries {
            upsert_managed_entry(&transaction, &scope.id, entry_id, scope.enabled, now)?;
            if remaining_initial_jobs > 0 && !entry.is_directory {
                enqueue_ai_jobs_for_entry_with_scopes(&transaction, entry_id, entry, &policies)?;
                remaining_initial_jobs -= 1;
            }
        }
""",
)

repository = "src-tauri/src/global_index/repository.rs"
replace_once(
    repository,
    """    for scope in scopes {
        let scope_id = &scope.id;
        let allow_local_ai = scope.allow_local_ai;
        let allow_cloud_ai = scope.allow_cloud_ai;
        let scope_path = &scope.path;
        if !path_is_within(&path_normalized, &scope_path) {
            continue;
        }
""",
    """    let Some(scope) = scopes
        .iter()
        .find(|scope| path_is_within(&path_normalized, &scope.path))
    else {
        return Ok(());
    };
    let scope_id = &scope.id;
    let allow_local_ai = scope.allow_local_ai;
    let allow_cloud_ai = scope.allow_cloud_ai;
""",
)
replace_once(
    repository,
    """        transaction.execute(
            r#"
            INSERT INTO ai_analysis_state (global_entry_id, status, input_fingerprint, provider, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(global_entry_id) DO UPDATE SET
                status = excluded.status,
                input_fingerprint = excluded.input_fingerprint,
                provider = excluded.provider,
                updated_at = excluded.updated_at
            "#,
            params![entry_id, status, fingerprint, provider, unix_now()],
        )?;
    }
    Ok(())
}
""",
    """    transaction.execute(
        r#"
        INSERT INTO ai_analysis_state (global_entry_id, status, input_fingerprint, provider, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(global_entry_id) DO UPDATE SET
            status = excluded.status,
            input_fingerprint = excluded.input_fingerprint,
            provider = excluded.provider,
            updated_at = excluded.updated_at
        "#,
        params![entry_id, status, fingerprint, provider, unix_now()],
    )?;
    Ok(())
}
""",
)

hardening_tests = Path("src-tauri/src/global_index/hardening_tests.rs")
text = hardening_tests.read_text(encoding="utf-8")
marker = "initial_scope_backfill_caps_jobs_but_manages_every_entry"
if marker not in text:
    text += r'''

#[test]
fn initial_scope_backfill_caps_jobs_but_manages_every_entry() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open database");
    db.upsert_global_volume(&volume()).expect("insert volume");
    let entries = (0..120)
        .map(|index| entry(&format!(r"C:\Managed\Bulk\file-{index:03}.txt")))
        .collect::<Vec<_>>();
    for batch in entries.chunks(40) {
        db.upsert_global_entries_batch(batch).expect("insert batch");
    }

    db.add_managed_scope(AddManagedScopeRequest {
        path: r"C:\Managed\Bulk".to_string(),
        global_entry_id: None,
        enabled: true,
        allow_local_ai: true,
        allow_cloud_ai: false,
    })
    .expect("add scope");

    let conn = db.conn().expect("connection");
    let managed_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM managed_entries WHERE enabled = 1",
            [],
            |row| row.get(0),
        )
        .expect("managed count");
    let job_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM ai_jobs", [], |row| row.get(0))
        .expect("job count");
    assert_eq!(managed_count, 120);
    assert_eq!(job_count, 100);

    drop(conn);
    drop(db);
    let _ = std::fs::remove_file(path);
}
'''
    hardening_tests.write_text(text, encoding="utf-8")

print("Applied managed-scope initial queue backpressure")
