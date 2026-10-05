use super::*;

#[test]
fn v2_validation_normalizes_weekdays_and_rejects_extensions() {
    for kind in ["manual", "managed_scope_change"] {
        normalize_trigger(&mut trigger(json!({"version":2,"kind":kind}))).unwrap();
    }
    let mut t = schedule("America/Los_Angeles", "09:00", &[5, 1, 1, 3]);
    normalize_trigger(&mut t).unwrap();
    assert_eq!(t.weekdays.unwrap(), vec![1, 3, 5]);
    for value in [
        json!({"version":1,"kind":"manual"}),
        json!({"version":2,"kind":"startup"}),
        json!({"version":2,"kind":"schedule","timeZone":"Mars/Olympus","localTime":"09:00","weekdays":[1]}),
        json!({"version":2,"kind":"schedule","timeZone":"UTC","localTime":"09:00:01","weekdays":[1]}),
        json!({"version":2,"kind":"schedule","timeZone":"UTC","localTime":"24:00","weekdays":[1]}),
        json!({"version":2,"kind":"schedule","timeZone":"UTC","localTime":"09:00","weekdays":[0,8]}),
        json!({"version":2,"kind":"schedule","timeZone":"UTC","localTime":"09:00","weekdays":[]}),
    ] {
        assert!(normalize_trigger(&mut trigger(value)).is_err());
    }
    for field in [
        "timeZone",
        "localTime",
        "weekdays",
        "cron",
        "seconds",
        "interval",
        "unexpected",
    ] {
        let mut value = json!({"version":2,"kind":"manual"});
        value[field] = json!("bad");
        assert!(serde_json::from_value::<AutomationTriggerV2>(value).is_err());
    }
}

#[test]
fn calendar_daily_weekly_custom_and_explicit_timezone() {
    let now = timestamp("2026-10-01T08:59:00Z");
    let daily = schedule("UTC", "09:00", &[1, 2, 3, 4, 5, 6, 7]);
    assert_eq!(
        next_occurrence(&daily, now).unwrap().instant,
        timestamp("2026-10-01T09:00:00Z")
    );
    assert_eq!(
        next_occurrence(&daily, timestamp("2026-10-01T09:00:00Z"))
            .unwrap()
            .instant,
        timestamp("2026-10-02T09:00:00Z")
    );
    assert_eq!(
        next_occurrence(&schedule("UTC", "09:00", &[1]), now)
            .unwrap()
            .instant,
        timestamp("2026-10-05T09:00:00Z")
    );
    assert_eq!(
        next_occurrence(&schedule("UTC", "09:00", &[2, 5]), now)
            .unwrap()
            .instant,
        timestamp("2026-10-02T09:00:00Z")
    );
    assert_eq!(
        next_occurrence(
            &schedule("Asia/Shanghai", "09:00", &[1, 2, 3, 4, 5, 6, 7]),
            now
        )
        .unwrap()
        .instant,
        timestamp("2026-10-02T01:00:00Z")
    );
}

#[test]
fn dst_fold_once_earlier_and_gap_first_valid_instant() {
    let days = [1, 2, 3, 4, 5, 6, 7];
    let fold = schedule("America/Los_Angeles", "01:30", &days);
    let first = next_occurrence(&fold, timestamp("2026-11-01T07:00:00Z")).unwrap();
    assert_eq!(first.instant, timestamp("2026-11-01T08:30:00Z"));
    assert_eq!(
        next_occurrence(&fold, first.instant).unwrap().instant,
        timestamp("2026-11-02T09:30:00Z")
    );
    assert_eq!(
        newest_due(&fold, timestamp("2026-11-01T09:40:00Z"), first.instant).unwrap(),
        first
    );
    let gap = next_occurrence(
        &schedule("America/Los_Angeles", "02:30", &days),
        timestamp("2026-03-08T08:00:00Z"),
    )
    .unwrap();
    assert_eq!(gap.instant, timestamp("2026-03-08T10:00:00Z"));
    assert_eq!(gap.logical_local, "2026-03-08T02:30");
}
