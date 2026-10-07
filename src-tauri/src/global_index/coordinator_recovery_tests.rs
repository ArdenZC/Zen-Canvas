struct RecoveryOutcomeProvider {
    source: GlobalSourceDescriptor,
    outcome: u8,
    rebuilds: AtomicUsize,
}
impl GlobalIndexProvider for RecoveryOutcomeProvider {
    fn discover_sources(&self) -> Result<Vec<GlobalSourceDescriptor>, GlobalIndexError> {
        Ok(vec![self.source.clone()])
    }
    fn start_initial_index(
        &self,
        _: &GlobalSourceDescriptor,
        _: &mut dyn GlobalIndexSink,
        _: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        unreachable!()
    }
    fn resume_incremental_sync(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        match self.outcome {
            0 => Err(GlobalIndexError::RebuildRequired("changed journal".into())),
            1 => {
                cancel.store(true, Ordering::Release);
                Err(GlobalIndexError::Paused)
            }
            2 => Err(GlobalIndexError::Paused),
            _ => {
                sink.set_source_state(
                    &source.volume.id,
                    INDEX_STATUS_PERMISSION_REQUIRED,
                    Some("access denied"),
                )?;
                Err(GlobalIndexError::Provider("access denied".into()))
            }
        }
    }
    fn rebuild(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        _: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        self.rebuilds.fetch_add(1, Ordering::AcqRel);
        sink.checkpoint(&source.volume.id, Some("new-journal"), Some("100"))?;
        Ok(())
    }
    fn pause(&self) -> Result<(), GlobalIndexError> {
        Ok(())
    }
    fn status(&self) -> Result<String, GlobalIndexError> {
        Ok("test".into())
    }
    fn shutdown(&self) -> Result<(), GlobalIndexError> {
        Ok(())
    }
}

#[test]
fn typed_recovery_survives_cycle_and_next_admitted_rebuild_reaches_ready() {
    for outcome in 0..4 {
        let path = TestDatabasePath::new();
        let db = Database::open(&path.0).unwrap();
        let source = GlobalSourceDescriptor {
            volume: GlobalVolume {
                id: "recovery-test".into(),
                platform: "windows".into(),
                stable_volume_id: "recovery-test".into(),
                display_name: "test".into(),
                mount_path: "test://metadata-only".into(),
                filesystem_type: "NTFS".into(),
                drive_kind: "fixed".into(),
                enabled: true,
                provider: PROVIDER_WINDOWS_MFT_USN.into(),
                index_status: INDEX_STATUS_READY.into(),
                last_error: None,
                journal_id: Some("old".into()),
                journal_cursor: Some("42".into()),
                last_full_index_at: Some(1),
                last_incremental_sync_at: Some(1),
                entry_count: 0,
                created_at: 1,
                updated_at: 1,
            },
        };
        db.upsert_global_volume(&source.volume).unwrap();
        let provider = RecoveryOutcomeProvider {
            source,
            outcome,
            rebuilds: AtomicUsize::new(0),
        };
        let cancel = Arc::new(AtomicBool::new(false));
        let wake = GlobalIndexWakeSlot::default();
        run_index_cycle(&provider, &db, &cancel, &wake).unwrap();
        let first = db.get_global_volume("recovery-test").unwrap().unwrap();
        match outcome {
            0 => {
                assert_eq!(first.index_status, INDEX_STATUS_REBUILD_REQUIRED);
                assert_eq!(wake.snapshot().notifications, 1);
                assert_eq!(provider.rebuilds.load(Ordering::Acquire), 0);
                run_index_cycle(&provider, &db, &cancel, &wake).unwrap();
                assert_eq!(provider.rebuilds.load(Ordering::Acquire), 1);
                let final_source = db.get_global_volume("recovery-test").unwrap().unwrap();
                assert_eq!(final_source.index_status, INDEX_STATUS_READY);
                assert_eq!(final_source.journal_cursor.as_deref(), Some("100"));
                assert!(final_source.last_full_index_at.unwrap() > 1);
            }
            1 | 2 => {
                assert_eq!(first.index_status, INDEX_STATUS_PAUSED);
                assert!(first.last_error.is_none());
            }
            _ => assert_eq!(first.index_status, INDEX_STATUS_PERMISSION_REQUIRED),
        }
    }
}
