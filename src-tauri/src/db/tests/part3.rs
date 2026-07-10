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

        db.save_operation_logs("batch-success", &[log.clone()])
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
    fn build_fts_query_quotes_terms_without_breaking_chinese_or_punctuation() {
        let query = build_fts_query("项目\"报告 final-v1.pdf").expect("query");

        assert_eq!(query, "\"项目\"\"报告\" AND \"final-v1.pdf\"");
    }
