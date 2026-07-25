from pathlib import Path


def ensure_replace(path: str, old: str, new: str, count: int | None = None) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    found = text.count(old)
    expected = count if count is not None else 1
    if found != expected:
        raise SystemExit(f"{path}: expected {expected} occurrences, found {found}: {old[:80]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


ensure_replace(
    "src-tauri/src/global_index/macos/fsevents.rs",
    "use super::{fsevent_callback, FseventInfo};",
    "use super::{fsevent_callback, fsevent_requires_full_reconcile, FseventInfo};",
)
ensure_replace(
    "src-tauri/src/global_index/macos/fsevents.rs",
    "unsafe { &*context.info.cast::<FseventInfo>() }",
    "&*context.info.cast::<FseventInfo>()",
    count=2,
)

spotlight = "src-tauri/src/global_index/macos/spotlight.rs"
ensure_replace(
    spotlight,
    "unsafe { center.removeObserver(&observer) };",
    "let observer_object: &AnyObject = observer.as_ref().as_ref();\n        unsafe { center.removeObserver(observer_object) };",
    count=2,
)
ensure_replace(
    spotlight,
    "let scopes = NSArray::from_slice(&[NSMetadataQueryIndexedLocalComputerScope]);\n    unsafe { query.setSearchScopes(&scopes) };",
    "let scope: &AnyObject = unsafe { NSMetadataQueryIndexedLocalComputerScope }.as_ref();\n    let scopes: Retained<NSArray<AnyObject>> = NSArray::from_slice(&[scope]);\n    unsafe { query.setSearchScopes(&scopes) };",
)
for key in [
    "NSMetadataItemPathKey",
    "NSMetadataItemURLKey",
    "NSMetadataItemFSNameKey",
    "NSMetadataItemFSSizeKey",
    "NSMetadataItemFSCreationDateKey",
    "NSMetadataItemFSContentChangeDateKey",
]:
    target = Path(spotlight)
    text = target.read_text(encoding="utf-8")
    safe = f"unsafe {{ {key} }}"
    if safe in text:
        continue
    old = f", {key})"
    new = f", {safe})"
    occurrences = text.count(old)
    if occurrences == 0:
        raise SystemExit(f"{spotlight}: no unwrapped usage for {key}")
    target.write_text(text.replace(old, new), encoding="utf-8")
ensure_replace(spotlight, "batches.iter().sum()", "batches.iter().sum::<usize>()")

ensure_replace(
    "src-tauri/src/global_index/managed_scope.rs",
    """            statement
                .query_map(
                    params![normalized_scope, pattern, last_id, BATCH_SIZE],
                    |row| Ok((global_entry_input_from_row(row)?, row.get::<_, String>(15)?)),
                )?
                .collect::<Result<Vec<_>, _>>()?
""",
    """            let rows = statement.query_map(
                params![normalized_scope, pattern, last_id, BATCH_SIZE],
                |row| Ok((global_entry_input_from_row(row)?, row.get::<_, String>(15)?)),
            )?;
            let entries = rows.collect::<Result<Vec<_>, _>>()?;
            entries
""",
)
ensure_replace(
    "src-tauri/src/global_index/repository.rs",
    """    statement
        .query_map([], |row| {
            Ok(ManagedScopePolicy {
                id: row.get(0)?,
                allow_local_ai: row.get::<_, i64>(1)? != 0,
                allow_cloud_ai: row.get::<_, i64>(2)? != 0,
                path: normalize_path(&row.get::<_, String>(3)?),
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)
""",
    """    let rows = statement.query_map([], |row| {
        Ok(ManagedScopePolicy {
            id: row.get(0)?,
            allow_local_ai: row.get::<_, i64>(1)? != 0,
            allow_cloud_ai: row.get::<_, i64>(2)? != 0,
            path: normalize_path(&row.get::<_, String>(3)?),
        })
    })?;
    let policies = rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)?;
    Ok(policies)
""",
)
ensure_replace(
    "src-tauri/src/global_index/search.rs",
    """        return statement
            .query_map(
                params![escape_like(query), limit, offset],
                map_global_search_result,
            )?
            .collect::<Result<Vec<_>, _>>()
            .map_err(DbError::from);
""",
    """        let rows = statement.query_map(
            params![escape_like(query), limit, offset],
            map_global_search_result,
        )?;
        let results = rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)?;
        return Ok(results);
""",
)
ensure_replace(
    "src-tauri/src/global_index/search.rs",
    """    statement
        .query_map(
            params![pattern, query, limit, offset],
            map_global_search_result,
        )?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)
""",
    """    let rows = statement.query_map(
        params![pattern, query, limit, offset],
        map_global_search_result,
    )?;
    let results = rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)?;
    Ok(results)
""",
)

print("Applied macOS compile fixes")
