use serde_json::{json, Value};
use std::error::Error;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use zen_canvas_tauri::db::Database;

fn main() -> Result<(), Box<dyn Error>> {
    let profile_root = std::env::var_os("ZC_NATIVE_QA_PROFILE_ROOT")
        .map(PathBuf::from)
        .ok_or("ZC_NATIVE_QA_PROFILE_ROOT is required for the isolated probe")?;
    if !profile_root.is_absolute() {
        return Err("ZC_NATIVE_QA_PROFILE_ROOT must be absolute".into());
    }
    let database = Database::open(profile_root.join("zen-canvas.sqlite3"))?;
    let stdin = io::stdin();
    let mut stdout = io::BufWriter::new(io::stdout().lock());

    for line in stdin.lock().lines() {
        let line = line?;
        let request: Value = serde_json::from_str(&line)?;
        let query = request
            .get("query")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let volumes = database
            .list_global_volumes()?
            .into_iter()
            .map(|volume| {
                json!({
                    "id": volume.id,
                    "mountPath": volume.mount_path,
                    "filesystemType": volume.filesystem_type,
                    "driveKind": volume.drive_kind,
                    "enabled": volume.enabled,
                    "provider": volume.provider,
                    "status": volume.index_status,
                    "lastError": volume.last_error,
                    "entryCount": volume.entry_count,
                    "lastFullIndexAt": volume.last_full_index_at,
                })
            })
            .collect::<Vec<_>>();
        let results = if query.is_empty() {
            Vec::new()
        } else {
            database
                .search_global_entries(query, 25, 0)?
                .into_iter()
                .map(|result| json!({"name": result.name, "path": result.path}))
                .collect::<Vec<_>>()
        };
        serde_json::to_writer(
            &mut stdout,
            &json!({"volumes": volumes, "results": results}),
        )?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }

    Ok(())
}
