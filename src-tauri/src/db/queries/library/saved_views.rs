use super::*;

impl Database {
    pub fn list_library_saved_views(&self) -> Result<Vec<LibrarySavedViewDto>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, display_name, query_spec_json, position, created_at, updated_at, revision FROM library_saved_views ORDER BY position, updated_at DESC, id",
        )?;
        let rows = stmt.query_map([], |row| saved_view_from_row(&conn, row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn create_library_saved_view(
        &self,
        request: CreateLibrarySavedViewRequest,
    ) -> Result<LibrarySavedViewDto, DbError> {
        let display_name = validate_saved_view_name(&request.display_name)?;
        let (spec, json, fingerprint) = canonicalize_file_query_spec(request.query)?;
        let normalized_name = normalize_tag_name(&display_name);
        let now = current_unix_seconds();
        let id = format!("library-view-{}", uuid::Uuid::new_v4());
        let position = request.position.unwrap_or(0).max(0);
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO library_saved_views(id, display_name, normalized_name, query_spec_version, query_spec_json, position, created_at, updated_at) VALUES (?1, ?2, ?3, 2, ?4, ?5, ?6, ?6)",
            params![id, display_name, normalized_name, json, position, now],
        ).map_err(map_saved_view_write_error)?;
        tx.commit()?;
        Ok(LibrarySavedViewDto {
            id,
            display_name,
            query: spec,
            query_fingerprint: fingerprint,
            position,
            created_at: now,
            updated_at: now,
            revision: 1,
            invalid_references: Vec::new(),
        })
    }

    pub fn update_library_saved_view(
        &self,
        request: UpdateLibrarySavedViewRequest,
    ) -> Result<LibrarySavedViewDto, DbError> {
        let id = validate_file_id(&request.id)?;
        let display_name = validate_saved_view_name(&request.display_name)?;
        let (spec, json, fingerprint) = canonicalize_file_query_spec(request.query)?;
        let normalized_name = normalize_tag_name(&display_name);
        let now = current_unix_seconds();
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let updated = tx.execute(
            "UPDATE library_saved_views SET display_name = ?1, normalized_name = ?2, query_spec_version = 2, query_spec_json = ?3, position = ?4, updated_at = ?5, revision = revision + 1 WHERE id = ?6 AND revision = ?7",
            params![display_name, normalized_name, json, request.position.max(0), now, id, request.expected_revision],
        ).map_err(map_saved_view_write_error)?;
        if updated != 1 {
            return Err(DbError::Validation(
                "library_saved_view_stale_or_missing".to_string(),
            ));
        }
        let created_at: i64 = tx.query_row(
            "SELECT created_at FROM library_saved_views WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;
        tx.commit()?;
        Ok(LibrarySavedViewDto {
            id,
            display_name,
            query: spec,
            query_fingerprint: fingerprint,
            position: request.position.max(0),
            created_at,
            updated_at: now,
            revision: request.expected_revision + 1,
            invalid_references: Vec::new(),
        })
    }

    pub fn delete_library_saved_view(
        &self,
        request: DeleteLibrarySavedViewRequest,
    ) -> Result<bool, DbError> {
        let id = validate_file_id(&request.id)?;
        let conn = self.conn()?;
        let changed = conn.execute(
            "DELETE FROM library_saved_views WHERE id = ?1 AND revision = ?2",
            params![id, request.expected_revision],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "library_saved_view_stale_or_missing".to_string(),
            ));
        }
        Ok(true)
    }
}

fn saved_view_from_row(conn: &Connection, row: &Row<'_>) -> rusqlite::Result<LibrarySavedViewDto> {
    let id: String = row.get(0)?;
    let display_name: String = row.get(1)?;
    let json: String = row.get(2)?;
    let (spec, _canonical_json, fingerprint) = canonicalize_file_query_spec(
        serde_json::from_str(&json).map_err(|_| rusqlite::Error::InvalidQuery)?,
    )
    .map_err(|_| rusqlite::Error::InvalidQuery)?;
    let invalid_references =
        saved_view_invalid_references(conn, &spec).map_err(|_| rusqlite::Error::InvalidQuery)?;
    Ok(LibrarySavedViewDto {
        id,
        display_name,
        query: spec,
        query_fingerprint: fingerprint,
        position: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        revision: row.get(6)?,
        invalid_references,
    })
}

fn saved_view_invalid_references(
    conn: &Connection,
    spec: &FileQuerySpecV2,
) -> Result<Vec<String>, DbError> {
    let mut invalid = Vec::new();
    match &spec.scope {
        FileLibraryScopeV2::Roots { scan_root_ids } => {
            for id in scan_root_ids {
                let available: Option<i64> = conn
                    .query_row(
                        "SELECT 1 FROM scan_roots
                     WHERE source_kind = 'file_library' AND id = ?1
                       AND enabled = 1 AND health_status = 'healthy'
                       AND needs_reconciliation = 0
                       AND watcher_rule_recovery_required = 0
                       AND watcher_revision = watcher_applied_revision",
                        params![id],
                        |row| row.get(0),
                    )
                    .optional()?;
                if available.is_none() {
                    invalid.push(format!("root:{id}"));
                }
            }
        }
        FileLibraryScopeV2::CurrentScan { scan_session_id } => {
            let exists: Option<i64> = conn
                .query_row(
                    "SELECT 1 FROM scan_sessions WHERE id = ?1",
                    params![scan_session_id],
                    |row| row.get(0),
                )
                .optional()?;
            if exists.is_none() {
                invalid.push(format!("session:{scan_session_id}"));
            }
        }
        FileLibraryScopeV2::AllEnabledRoots => {}
    }
    for id in spec
        .filters
        .tags_all_of
        .iter()
        .chain(spec.filters.tags_any_of.iter())
        .chain(spec.filters.tags_none_of.iter())
    {
        if !tag_exists(conn, id)? {
            invalid.push(format!("tag:{id}"));
        }
    }
    invalid.sort();
    invalid.dedup();
    Ok(invalid)
}
