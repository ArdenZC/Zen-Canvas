    #[test]
    fn operation_log_tables_exist_after_migration() {
        let db = Database::open(test_db_path()).expect("open test database");
        let conn = Connection::open(db.path()).expect("open migrated database");

        let table_count: i64 = conn
            .query_row(
                r#"
                SELECT COUNT(*)
                FROM sqlite_schema
                WHERE type = 'table'
                  AND name IN ('operation_batches', 'operation_logs')
                "#,
                [],
                |row| row.get(0),
            )
            .expect("count operation tables");

        assert_eq!(table_count, 2);
    }

    #[test]
    fn get_operation_logs_returns_empty_array_for_empty_table() {
        let db = Database::open(test_db_path()).expect("open test database");

        let logs = db.get_operation_logs(Some(500)).expect("operation logs");

        assert!(logs.is_empty());
    }

    #[test]
    fn save_operation_logs_persists_success_log() {
        let db = Database::open(test_db_path()).expect("open test database");
        let log = operation_log("log-success", "batch-success", "success");

        db.save_operation_logs("batch-success", std::slice::from_ref(&log))
            .expect("save operation logs");
        let logs = db.get_operation_logs(Some(10)).expect("operation logs");

        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].id, log.id);
        assert_eq!(logs[0].batch_id, "batch-success");
        assert_eq!(logs[0].status, "success");
        assert!(logs[0].can_restore);
        assert_eq!(operation_batch_status(&db, "batch-success"), "success");
    }

    #[test]
    fn save_operation_logs_persists_failed_log() {
        let db = Database::open(test_db_path()).expect("open test database");
        let mut log = operation_log("log-failed", "batch-failed", "failed");
        log.error_message = Some("Source file does not exist.".to_string());
        log.can_undo = false;
        log.can_restore = false;

        db.save_operation_logs("batch-failed", &[log.clone()])
            .expect("save operation logs");
        let logs = db.get_operation_logs(Some(10)).expect("operation logs");

        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].status, "failed");
        assert_eq!(
            logs[0].error_message.as_deref(),
            Some("Source file does not exist.")
        );
        assert!(!logs[0].can_restore);
        assert_eq!(
            operation_batch_status(&db, "batch-failed"),
            "partial_failed"
        );
    }

    #[test]
    fn save_operation_logs_persists_skipped_log() {
        let db = Database::open(test_db_path()).expect("open test database");
        let mut log = operation_log("log-skipped", "batch-skipped", "skipped");
        log.error_message = Some("Operation is not executable.".to_string());
        log.can_undo = false;
        log.can_restore = false;

        db.save_operation_logs("batch-skipped", &[log.clone()])
            .expect("save operation logs");
        let logs = db.get_operation_logs(Some(10)).expect("operation logs");

        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].status, "skipped");
        assert_eq!(
            logs[0].error_message.as_deref(),
            Some("Operation is not executable.")
        );
        assert!(!logs[0].can_restore);
        assert_eq!(operation_batch_status(&db, "batch-skipped"), "skipped");
    }

    #[test]
    fn update_operation_restore_logs_marks_restored_log() {
        let db = Database::open(test_db_path()).expect("open test database");
        let mut log = operation_log("log-restored", "batch-restored", "success");
        db.save_operation_logs("batch-restored", &[log.clone()])
            .expect("save operation logs");

        log.can_undo = false;
        log.can_restore = false;
        log.restored_at = Some("1900000000999".to_string());
        log.restore_status = "restored".to_string();
        log.restore_error = None;
        db.update_operation_restore_logs(&[log])
            .expect("update restore logs");

        let logs = db.get_operation_logs(Some(10)).expect("operation logs");
        assert_eq!(logs[0].restore_status, "restored");
        assert!(!logs[0].can_restore);
        assert!(!logs[0].can_undo);
        assert_eq!(logs[0].restored_at.as_deref(), Some("1900000000999"));
        assert!(logs[0].restore_error.is_none());
    }

    #[test]
    fn update_operation_restore_logs_marks_failed_log() {
        let db = Database::open(test_db_path()).expect("open test database");
        let mut log = operation_log("log-restore-failed", "batch-restore-failed", "success");
        db.save_operation_logs("batch-restore-failed", &[log.clone()])
            .expect("save operation logs");

        log.restore_status = "failed".to_string();
        log.restore_error = Some("Target file already exists.".to_string());
        db.update_operation_restore_logs(&[log])
            .expect("update restore logs");

        let logs = db.get_operation_logs(Some(10)).expect("operation logs");
        assert_eq!(logs[0].restore_status, "failed");
        assert_eq!(
            logs[0].restore_error.as_deref(),
            Some("Target file already exists.")
        );
    }

    #[test]
    fn update_operation_restore_logs_marks_unavailable_log() {
        let db = Database::open(test_db_path()).expect("open test database");
        let mut log = operation_log("log-unavailable", "batch-unavailable", "skipped");
        log.can_undo = false;
        log.can_restore = false;
        db.save_operation_logs("batch-unavailable", &[log.clone()])
            .expect("save operation logs");

        log.restore_status = "unavailable".to_string();
        log.restore_error = Some("Only successful operations can be restored.".to_string());
        db.update_operation_restore_logs(&[log])
            .expect("update restore logs");

        let logs = db.get_operation_logs(Some(10)).expect("operation logs");
        assert_eq!(logs[0].restore_status, "unavailable");
        assert!(!logs[0].can_restore);
        assert_eq!(
            logs[0].restore_error.as_deref(),
            Some("Only successful operations can be restored.")
        );
    }

    #[test]
    fn restore_claim_journal_is_independent_and_terminal_manual_review_is_not_requeued() {
        let db = Database::open(test_db_path()).expect("open test database");
        let mut log = operation_log("log-restore-claim", "batch-restore-claim", "success");
        db.save_operation_logs("batch-restore-claim", std::slice::from_ref(&log))
            .expect("save restore claim log");

        log.restore_claim_path = Some("C:/fixture/.zen-canvas-claim-uuid".to_string());
        log.restore_claim_created_at = Some("1900000000000".to_string());
        log.restore_claim_platform_file_id = Some("platform-file".to_string());
        log.restore_claim_full_hash = Some("full-hash".to_string());
        db.prepare_operation_restores(std::slice::from_ref(&log))
            .expect("prepare restore claim journal");

        let pending = db
            .get_pending_restore_logs()
            .expect("read pending restore claim")
            .into_iter()
            .find(|item| item.id == log.id)
            .expect("pending restore claim row");
        assert_eq!(pending.restore_phase, "prepared");
        assert_eq!(
            pending.restore_claim_path.as_deref(),
            Some("C:/fixture/.zen-canvas-claim-uuid")
        );
        assert_eq!(pending.operation_phase, "completed");

        let mut manual = pending;
        manual.status = "manual_review".to_string();
        manual.restore_status = "manual_review".to_string();
        manual.restore_phase = "source_claimed".to_string();
        db.finalize_operation_restore_outcome(std::slice::from_ref(&manual))
            .expect("persist source-claimed manual review");
        assert!(db
            .get_pending_restore_logs()
            .expect("manual source-claimed restore is not retried")
            .is_empty());

        manual.restore_phase = "completed".to_string();
        db.finalize_operation_restore_outcome(std::slice::from_ref(&manual))
            .expect("persist final-transaction manual review");
        assert_eq!(db.get_pending_restore_logs().expect("requeue final transaction").len(), 1);
    }

    #[test]
    fn ordinary_restore_finalization_upserts_missing_index_row_and_fts() {
        let db = Database::open(test_db_path()).expect("open test database");
        let root = test_dir();
        let source = root.join("restore-source.txt");
        let target = root.join("restore-target.txt");
        fs::write(&source, "restore index upsert").expect("write source");

        let source_path = normalized_test_path(&source);
        let target_path = normalized_test_path(&target);
        let restored_path = source_path.clone();
        let mut log = operation_log("log-restore-index-upsert", "batch-restore-index", "success");
        log.source_path = source_path.clone();
        log.target_path = target_path.clone();
        log.path_before = source_path;
        log.path_after = target_path.clone();
        log.name_before = "restore-source.txt".to_string();
        log.name_after = "restore-target.txt".to_string();
        log.new_name = "restore-target.txt".to_string();
        let identity = crate::file_ops::file_identity_fingerprint(&source)
            .expect("capture restore identity");
        log.source_size = Some(identity.size);
        log.source_modified_ns = identity.modified_ns.map(|value| value.to_string());
        log.source_platform_file_id = identity.platform_file_id;
        log.source_quick_hash = identity.quick_hash;
        log.source_full_hash = identity.full_hash;
        db.save_operation_logs("batch-restore-index", std::slice::from_ref(&log))
            .expect("save restore index log");

        log.restore_status = "restored".to_string();
        log.restore_phase = "completed".to_string();
        log.restored_at = Some("1900000000123".to_string());
        db.finalize_successful_operation_restore(&log)
            .expect("finalize restore with missing index row");

        let conn = Connection::open(db.path()).expect("open finalized database");
        let indexed: (String, String, i64, i64) = conn
            .query_row(
                "SELECT id, path, size, is_stale FROM files WHERE path = ?1",
                params![restored_path],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("restored file index row");
        assert_eq!(indexed.0, indexed.1);
        assert_eq!(indexed.2, 20);
        assert_eq!(indexed.3, 0);

        let fts_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM files_fts WHERE name = ?1",
                params!["restore-source.txt"],
                |row| row.get(0),
            )
            .expect("restored file FTS row");
        assert_eq!(fts_count, 1);

        let restored_log = db
            .get_operation_logs(Some(10))
            .expect("read finalized restore log")
            .into_iter()
            .find(|item| item.id == log.id)
            .expect("finalized restore log");
        assert_eq!(restored_log.status, "success");
        assert_eq!(restored_log.restore_status, "restored");
        assert_eq!(restored_log.restore_phase, "completed");
        assert!(!restored_log.can_restore);
    }

    #[test]
    fn ordinary_restore_finalization_rolls_back_index_when_journal_update_fails() {
        let db_path = test_db_path();
        let db = Database::open(&db_path).expect("open test database");
        let root = test_dir();
        let source = root.join("restore-atomic-source.txt");
        let target = root.join("restore-atomic-target.txt");
        fs::write(&source, "restore atomic boundary").expect("write source");

        let source_path = normalized_test_path(&source);
        let target_path = normalized_test_path(&target);
        let mut log = operation_log("log-restore-atomic", "batch-restore-atomic", "success");
        log.source_path = source_path.clone();
        log.target_path = target_path.clone();
        log.path_before = source_path;
        log.path_after = target_path;
        log.name_before = "restore-atomic-source.txt".to_string();
        log.name_after = "restore-atomic-target.txt".to_string();
        log.new_name = "restore-atomic-target.txt".to_string();
        let identity = crate::file_ops::file_identity_fingerprint(&source)
            .expect("capture atomic restore identity");
        log.source_size = Some(identity.size);
        log.source_modified_ns = identity.modified_ns.map(|value| value.to_string());
        log.source_platform_file_id = identity.platform_file_id;
        log.source_quick_hash = identity.quick_hash;
        log.source_full_hash = identity.full_hash;
        db.save_operation_logs("batch-restore-atomic", std::slice::from_ref(&log))
            .expect("save atomic restore log");

        let conn = Connection::open(&db_path).expect("open trigger database");
        conn.execute_batch(
            r#"
            CREATE TRIGGER reject_restore_final_journal
            BEFORE UPDATE OF restore_status ON operation_logs
            WHEN NEW.restore_status = 'restored'
            BEGIN
                SELECT RAISE(ABORT, 'injected restore final journal failure');
            END;
            "#,
        )
        .expect("install restore finalization trigger");
        drop(conn);

        log.restore_status = "restored".to_string();
        log.restore_phase = "completed".to_string();
        log.restored_at = Some("1900000000123".to_string());
        assert!(db.finalize_successful_operation_restore(&log).is_err());

        let conn = Connection::open(db.path()).expect("open rollback database");
        let indexed_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .expect("count rolled back index rows");
        assert_eq!(indexed_count, 0);
        let restore_status: String = conn
            .query_row(
                "SELECT restore_status FROM operation_logs WHERE id = ?1",
                params![log.id],
                |row| row.get(0),
            )
            .expect("read rolled back restore journal");
        assert_eq!(restore_status, "not_restored");
    }

    #[test]
    fn ordinary_restore_finalization_resolves_source_target_rows_without_broad_delete() {
        for case in ["source-only", "target-only", "same-row", "distinct-rows"] {
            let db = Database::open(test_db_path()).expect("open restore matrix database");
            let root = test_dir();
            let source = root.join(format!("{case}-before.txt"));
            let target = root.join(format!("{case}-after.txt"));
            fs::write(&source, format!("restore matrix {case}")).expect("write matrix source");
            let source_path = normalized_test_path(&source);
            let target_path = normalized_test_path(&target);
            let mut log = operation_log(
                &format!("log-restore-{case}"),
                &format!("batch-restore-{case}"),
                "success",
            );
            log.source_path = source_path.clone();
            log.target_path = target_path.clone();
            log.path_before = source_path.clone();
            log.path_after = target_path.clone();
            log.name_before = source.file_name().unwrap().to_string_lossy().into_owned();
            log.name_after = target.file_name().unwrap().to_string_lossy().into_owned();
            log.new_name = log.name_after.clone();
            let identity = crate::file_ops::file_identity_fingerprint(&source)
                .expect("capture matrix restore identity");
            log.source_size = Some(identity.size);
            log.source_modified_ns = identity.modified_ns.map(|value| value.to_string());
            log.source_platform_file_id = identity.platform_file_id;
            log.source_quick_hash = identity.quick_hash;
            log.source_full_hash = identity.full_hash;
            log.restore_status = "restored".to_string();
            log.restore_phase = "completed".to_string();
            log.restored_at = Some("1900000000123".to_string());
            db.save_operation_logs(&log.batch_id, std::slice::from_ref(&log))
                .expect("save matrix restore log");

            let size = fs::metadata(&source).expect("matrix metadata").len() as i64;
            let mtime = fs::metadata(&source)
                .expect("matrix metadata")
                .modified()
                .expect("matrix mtime")
                .duration_since(UNIX_EPOCH)
                .expect("matrix mtime epoch")
                .as_secs() as i64;
            let insert = |id: &str, path: &str, name: &str| {
                db.insert_file(InsertFileRequest {
                    id: id.to_string(),
                    path: path.to_string(),
                    name: name.to_string(),
                    extension: "txt".to_string(),
                    size,
                    mtime,
                    ctime: 0,
                    is_dir: false,
                    state_code: 0,
                })
                .expect("insert matrix index row");
            };
            match case {
                "source-only" => insert("source-row", &target_path, &log.name_after),
                "target-only" | "same-row" => insert("target-row", &source_path, &log.name_before),
                "distinct-rows" => {
                    insert("target-row", &source_path, &log.name_before);
                    insert("source-row", &target_path, &log.name_after);
                    let conn = Connection::open(db.path()).expect("open matrix metadata database");
                    conn.execute(
                        "UPDATE files SET purpose = 'UserMetadata', suggested_action = 'Review', requires_confirmation = 1 WHERE id = 'target-row'",
                        [],
                    )
                    .expect("set watcher metadata");
                }
                _ => unreachable!(),
            }

            db.finalize_successful_operation_restore(&log)
                .expect("finalize matrix restore");
            let conn = Connection::open(db.path()).expect("open finalized matrix database");
            let row_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
                .expect("count matrix index rows");
            let fts_count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM files_fts WHERE name = ?1",
                    params![log.name_before],
                    |row| row.get(0),
                )
                .expect("count matrix FTS rows");
            assert_eq!(row_count, 1, "row matrix case: {case}");
            assert_eq!(fts_count, 1, "FTS matrix case: {case}");
            if case == "distinct-rows" {
                let metadata: (String, i64) = conn
                    .query_row(
                        "SELECT purpose, requires_confirmation FROM files WHERE path = ?1",
                        params![source_path],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .expect("read preserved watcher metadata");
                assert_eq!(metadata, ("UserMetadata".to_string(), 1));
            }
        }
    }

    #[test]
    fn ordinary_restore_reconciliation_rejects_reappeared_source_and_preserves_claim() {
        let db = Database::open(test_db_path()).expect("open reappeared-source database");
        let root = test_dir();
        let source = root.join("reappeared-before.txt");
        let after = root.join("reappeared-after.txt");
        fs::write(&source, "original restore payload").expect("write restore target");
        fs::write(&after, "replacement source payload").expect("write reappeared source");

        let source_identity = crate::file_ops::file_identity_fingerprint(&source)
            .expect("capture reappeared target identity");
        let mut log = operation_log(
            "log-restore-source-reappeared",
            "batch-restore-source-reappeared",
            "success",
        );
        log.source_path = normalized_test_path(&source);
        log.target_path = normalized_test_path(&after);
        log.path_before = log.source_path.clone();
        log.path_after = log.target_path.clone();
        log.name_before = "reappeared-before.txt".to_string();
        log.name_after = "reappeared-after.txt".to_string();
        log.new_name = log.name_after.clone();
        log.source_size = Some(source_identity.size);
        log.source_modified_ns = source_identity
            .modified_ns
            .map(|value| value.to_string());
        log.source_platform_file_id = source_identity.platform_file_id.clone();
        log.source_platform_volume_id = source_identity.platform_volume_id.clone();
        log.source_quick_hash = source_identity.quick_hash.clone();
        log.source_full_hash = source_identity.full_hash.clone();
        log.target_platform_file_id = source_identity.platform_file_id.clone();
        log.target_platform_volume_id = source_identity.platform_volume_id.clone();
        log.target_full_hash = source_identity.full_hash.clone();
        log.restore_status = "pending".to_string();
        log.restore_phase = "target_committed".to_string();
        log.restore_claim_path = Some(normalized_test_path(
            &root.join(".zen-canvas-claim-reappeared"),
        ));
        log.restore_claim_created_at = Some("1900000000123".to_string());
        log.restore_claim_platform_file_id = source_identity.platform_file_id.clone();
        log.restore_claim_platform_volume_id = source_identity.platform_volume_id.clone();
        log.restore_claim_full_hash = source_identity.full_hash.clone();
        db.save_operation_logs(&log.batch_id, std::slice::from_ref(&log))
            .expect("save reappeared restore log");

        let insert_index_row = |id: &str, path: &Path| {
            let metadata = fs::metadata(path).expect("reappeared metadata");
            db.insert_file(InsertFileRequest {
                id: id.to_string(),
                path: normalized_test_path(path),
                name: path.file_name().unwrap().to_string_lossy().into_owned(),
                extension: "txt".to_string(),
                size: metadata.len() as i64,
                mtime: metadata
                    .modified()
                    .expect("reappeared mtime")
                    .duration_since(UNIX_EPOCH)
                    .expect("reappeared mtime epoch")
                    .as_secs() as i64,
                ctime: 0,
                is_dir: false,
                state_code: 0,
            })
            .expect("insert reappeared index row");
        };
        insert_index_row("reappeared-target-row", &source);
        insert_index_row("reappeared-source-row", &after);

        assert_eq!(
            crate::file_ops::reconcile_pending_operation_journal(&db)
                .expect("reconcile reappeared restore"),
            1
        );
        let reconciled = db.get_operation_logs(Some(10)).expect("read reappeared log");
        let reconciled = reconciled
            .iter()
            .find(|candidate| candidate.id == log.id)
            .expect("reconciled reappeared log");
        assert_eq!(reconciled.restore_status, "manual_review");
        assert_eq!(reconciled.restore_phase, "source_cleanup_pending");
        assert_eq!(
            reconciled.restore_error.as_deref().unwrap_or_default(),
            "restore_source_path_reappeared: restore source path reappeared after the target commit; preserve the claim and review both paths"
        );
        assert_eq!(reconciled.restore_claim_path, log.restore_claim_path);
        assert_eq!(
            reconciled.restore_claim_platform_file_id,
            log.restore_claim_platform_file_id
        );
        assert_eq!(reconciled.restore_claim_full_hash, log.restore_claim_full_hash);

        let conn = Connection::open(db.path()).expect("open reappeared index database");
        let file_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .expect("count reappeared index rows");
        assert_eq!(file_count, 2);
        assert_eq!(fs::read_to_string(&after).expect("read reappeared source"), "replacement source payload");
    }

    #[test]
    fn ordinary_restore_finalization_rejects_target_identity_mismatch_before_index_write() {
        let db = Database::open(test_db_path()).expect("open identity-mismatch database");
        let root = test_dir();
        let source = root.join("identity-mismatch-before.txt");
        let after = root.join("identity-mismatch-after.txt");
        fs::write(&source, "original identity payload").expect("write identity target");
        let identity = crate::file_ops::file_identity_fingerprint(&source)
            .expect("capture identity-mismatch target");

        let mut log = operation_log(
            "log-restore-identity-mismatch",
            "batch-restore-identity-mismatch",
            "success",
        );
        log.source_path = normalized_test_path(&source);
        log.target_path = normalized_test_path(&after);
        log.path_before = log.source_path.clone();
        log.path_after = log.target_path.clone();
        log.name_before = "identity-mismatch-before.txt".to_string();
        log.name_after = "identity-mismatch-after.txt".to_string();
        log.new_name = log.name_after.clone();
        log.source_size = Some(identity.size);
        log.source_modified_ns = identity.modified_ns.map(|value| value.to_string());
        log.source_platform_file_id = identity.platform_file_id.clone();
        log.source_platform_volume_id = identity.platform_volume_id.clone();
        log.source_quick_hash = identity.quick_hash.clone();
        log.source_full_hash = identity.full_hash.clone();
        log.target_platform_file_id = identity.platform_file_id;
        log.target_platform_volume_id = identity.platform_volume_id;
        log.target_full_hash = identity.full_hash;
        db.save_operation_logs(&log.batch_id, std::slice::from_ref(&log))
            .expect("save identity-mismatch log");
        log.restore_status = "restored".to_string();
        log.restore_phase = "completed".to_string();
        log.restored_at = Some("1900000000123".to_string());

        fs::write(&source, "replacement identity payload").expect("replace identity target");
        let error = db
            .finalize_successful_operation_restore(&log)
            .expect_err("identity mismatch must block finalization")
            .to_string();
        assert!(error.starts_with("target_committed_identity_mismatch:"));

        let conn = Connection::open(db.path()).expect("open identity-mismatch database");
        let file_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .expect("count identity-mismatch index rows");
        assert_eq!(file_count, 0);
        let restore_status: String = conn
            .query_row(
                "SELECT restore_status FROM operation_logs WHERE id = ?1",
                params![log.id],
                |row| row.get(0),
            )
            .expect("read identity-mismatch journal");
        assert_eq!(restore_status, "not_restored");
    }

    #[test]
    fn build_fts_query_quotes_terms_without_breaking_chinese_or_punctuation() {
        let query = build_fts_query("项目\"报告 final-v1.pdf").expect("query");

        assert_eq!(query, "\"项目\"\"报告\" AND \"final-v1.pdf\"");
    }
