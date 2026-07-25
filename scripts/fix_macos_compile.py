from pathlib import Path


def replace(path: str, old: str, new: str, count: int | None = None) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    found = text.count(old)
    expected = count if count is not None else 1
    if found != expected:
        raise SystemExit(f"{path}: expected {expected} occurrences, found {found}: {old[:80]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


replace(
    "src-tauri/src/global_index/macos/fsevents.rs",
    "use super::{fsevent_callback, FseventInfo};",
    "use super::{fsevent_callback, fsevent_requires_full_reconcile, FseventInfo};",
)
replace(
    "src-tauri/src/global_index/macos/fsevents.rs",
    "unsafe { &*context.info.cast::<FseventInfo>() }",
    "&*context.info.cast::<FseventInfo>()",
    count=2,
)

spotlight = "src-tauri/src/global_index/macos/spotlight.rs"
replace(
    spotlight,
    "unsafe { center.removeObserver(&observer) };",
    "let observer_object: &AnyObject = observer.as_ref();\n        unsafe { center.removeObserver(observer_object) };",
    count=1,
)
replace(
    spotlight,
    "query.stopQuery();\n    unsafe { center.removeObserver(&observer) };",
    "query.stopQuery();\n    let observer_object: &AnyObject = observer.as_ref();\n    unsafe { center.removeObserver(observer_object) };",
)
replace(
    spotlight,
    "let scopes = NSArray::from_slice(&[NSMetadataQueryIndexedLocalComputerScope]);\n    unsafe { query.setSearchScopes(&scopes) };",
    "let scope: &AnyObject = unsafe { NSMetadataQueryIndexedLocalComputerScope };\n    let scopes: Retained<NSArray<AnyObject>> = NSArray::from_slice(&[scope]);\n    unsafe { query.setSearchScopes(&scopes) };",
)
for key in [
    "NSMetadataItemPathKey",
    "NSMetadataItemURLKey",
    "NSMetadataItemFSNameKey",
    "NSMetadataItemFSSizeKey",
    "NSMetadataItemFSCreationDateKey",
    "NSMetadataItemFSContentChangeDateKey",
]:
    text = Path(spotlight).read_text(encoding="utf-8")
    old = f", {key})"
    new = f", unsafe {{ {key} }})"
    occurrences = text.count(old)
    if occurrences == 0:
        raise SystemExit(f"{spotlight}: no unwrapped usage for {key}")
    Path(spotlight).write_text(text.replace(old, new), encoding="utf-8")
replace(spotlight, "batches.iter().sum()", "batches.iter().sum::<usize>()")

replace(
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
replace(
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
replace(
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
replace(
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
