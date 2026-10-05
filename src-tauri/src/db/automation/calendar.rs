//! Calendar recurrence only. Jiff owns IANA rules; no runtime or clock polling.
use super::{repository::invalid, types::AutomationTriggerV2};
use crate::db::DbError;
use jiff::{
    civil::Date,
    tz::{AmbiguousOffset, TimeZone},
    Timestamp,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Occurrence {
    pub instant: i64,
    pub logical_local: String,
}

pub(super) fn normalize_trigger(trigger: &mut AutomationTriggerV2) -> Result<(), DbError> {
    if trigger.version != 2 {
        return Err(invalid("automation_trigger_invalid"));
    }
    match trigger.kind.as_str() {
        "manual" | "managed_scope_change"
            if trigger.time_zone.is_none()
                && trigger.local_time.is_none()
                && trigger.weekdays.is_none() =>
        {
            Ok(())
        }
        "schedule" => {
            let zone = trigger
                .time_zone
                .as_deref()
                .ok_or_else(|| invalid("automation_timezone_invalid"))?;
            if zone.is_empty() || zone.len() > 128 {
                return Err(invalid("automation_timezone_invalid"));
            }
            TimeZone::get(zone).map_err(|_| invalid("automation_timezone_invalid"))?;
            parse_time(trigger.local_time.as_deref().unwrap_or(""))?;
            let days = trigger
                .weekdays
                .as_mut()
                .ok_or_else(|| invalid("automation_weekdays_invalid"))?;
            if days.is_empty() || days.len() > 64 || days.iter().any(|day| !(1..=7).contains(day)) {
                return Err(invalid("automation_weekdays_invalid"));
            }
            days.sort_unstable();
            days.dedup();
            Ok(())
        }
        _ => Err(invalid("automation_trigger_invalid")),
    }
}

fn parse_time(text: &str) -> Result<(i8, i8), DbError> {
    let bytes = text.as_bytes();
    if bytes.len() != 5
        || bytes[2] != b':'
        || ![bytes[0], bytes[1], bytes[3], bytes[4]]
            .iter()
            .all(u8::is_ascii_digit)
    {
        return Err(invalid("automation_local_time_invalid"));
    }
    let hour = ((bytes[0] - b'0') * 10 + bytes[1] - b'0') as i8;
    let minute = ((bytes[3] - b'0') * 10 + bytes[4] - b'0') as i8;
    if hour > 23 || minute > 59 {
        return Err(invalid("automation_local_time_invalid"));
    }
    Ok((hour, minute))
}

fn on_date(
    trigger: &AutomationTriggerV2,
    zone: &TimeZone,
    date: Date,
) -> Result<Option<Occurrence>, DbError> {
    if !trigger
        .weekdays
        .as_ref()
        .unwrap()
        .contains(&date.weekday().to_monday_one_offset())
    {
        return Ok(None);
    }
    let (hour, minute) = parse_time(trigger.local_time.as_deref().unwrap())?;
    let local = date.at(hour, minute, 0, 0);
    let ambiguous = zone.to_ambiguous_zoned(local);
    let instant = if matches!(ambiguous.offset(), AmbiguousOffset::Gap { .. }) {
        // Jiff supplies the actual transition instant, including historical
        // transitions with second precision. Do not shift the requested minute.
        let before_gap = ambiguous
            .earlier()
            .map_err(|_| invalid("automation_schedule_range"))?
            .timestamp();
        let transition = zone
            .following(before_gap)
            .next()
            .ok_or_else(|| invalid("automation_schedule_range"))?;
        let instant = transition.timestamp();
        if instant.to_zoned(zone.clone()).date() != date {
            return Ok(None);
        }
        instant.as_second()
    } else {
        ambiguous
            .earlier()
            .map_err(|_| invalid("automation_schedule_range"))?
            .timestamp()
            .as_second()
    };
    Ok(Some(Occurrence {
        instant,
        logical_local: format!("{date}T{:02}:{:02}", hour, minute),
    }))
}

fn zone_and_date(trigger: &AutomationTriggerV2, now: i64) -> Result<(TimeZone, Date), DbError> {
    let zone = TimeZone::get(trigger.time_zone.as_deref().unwrap_or(""))
        .map_err(|_| invalid("automation_timezone_invalid"))?;
    let date = Timestamp::from_second(now)
        .map_err(|_| invalid("automation_schedule_range"))?
        .to_zoned(zone.clone())
        .date();
    Ok((zone, date))
}
pub(super) fn next_occurrence(
    trigger: &AutomationTriggerV2,
    after: i64,
) -> Result<Occurrence, DbError> {
    let (zone, mut date) = zone_and_date(trigger, after)?;
    // At most eight dates, including a rare timezone date skipped entirely.
    for _ in 0..15 {
        if let Some(occurrence) = on_date(trigger, &zone, date)? {
            if occurrence.instant > after {
                return Ok(occurrence);
            }
        }
        date = date
            .checked_add(jiff::Span::new().days(1))
            .map_err(|_| invalid("automation_schedule_range"))?;
    }
    Err(invalid("automation_schedule_range"))
}
pub(super) fn newest_due(
    trigger: &AutomationTriggerV2,
    now: i64,
    first_due: i64,
) -> Result<Occurrence, DbError> {
    let (zone, mut date) = zone_and_date(trigger, now)?;
    // Look backwards only one recurrence week, irrespective of downtime.
    for _ in 0..15 {
        if let Some(occurrence) = on_date(trigger, &zone, date)? {
            if occurrence.instant <= now && occurrence.instant >= first_due {
                return Ok(occurrence);
            }
        }
        date = date
            .checked_add(jiff::Span::new().days(-1))
            .map_err(|_| invalid("automation_schedule_range"))?;
    }
    Err(invalid("automation_schedule_range"))
}
