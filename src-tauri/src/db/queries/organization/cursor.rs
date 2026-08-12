use super::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct OrganizationItemCursor {
    pub(super) ordinal: i64,
    pub(super) id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct OrganizationGroupCursor {
    pub(super) version: i32,
    pub(super) projection_fingerprint: String,
    pub(super) label: String,
    pub(super) group_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct OrganizationGroupItemCursor {
    pub(super) version: i32,
    pub(super) projection_fingerprint: String,
    pub(super) group_id: String,
    pub(super) ordinal: i64,
    pub(super) id: String,
}

pub(super) fn encode_item_cursor(cursor: &OrganizationItemCursor) -> String {
    serde_json::to_vec(cursor)
        .unwrap_or_default()
        .into_iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub(super) fn decode_item_cursor(value: &str) -> Result<OrganizationItemCursor, DbError> {
    if value.is_empty() || value.len() > 2048 || !value.len().is_multiple_of(2) {
        return Err(DbError::Validation(
            "organization_item_cursor_invalid".to_string(),
        ));
    }
    let bytes = (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| DbError::Validation("organization_item_cursor_invalid".to_string()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let cursor: OrganizationItemCursor = serde_json::from_slice(&bytes)
        .map_err(|_| DbError::Validation("organization_item_cursor_invalid".to_string()))?;
    validate_id(&cursor.id, "organization_item_cursor_invalid")?;
    if cursor.ordinal < 0 {
        return Err(DbError::Validation(
            "organization_item_cursor_invalid".to_string(),
        ));
    }
    Ok(cursor)
}

pub(super) fn encode_group_cursor(cursor: &OrganizationGroupCursor) -> String {
    serde_json::to_vec(cursor)
        .unwrap_or_default()
        .into_iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub(super) fn decode_group_cursor(value: &str) -> Result<OrganizationGroupCursor, DbError> {
    let cursor: OrganizationGroupCursor =
        decode_cursor_json(value, "organization_group_cursor_invalid")?;
    if cursor.version != ORGANIZATION_GROUP_CURSOR_VERSION
        || cursor.projection_fingerprint.is_empty()
        || cursor.projection_fingerprint.len() > 256
        || cursor
            .projection_fingerprint
            .chars()
            .any(|ch| ch.is_control())
        || cursor.label.is_empty()
        || cursor.label.len() > 2048
        || cursor.label.chars().any(|ch| ch.is_control())
    {
        return Err(DbError::Validation(
            "organization_group_cursor_invalid".to_string(),
        ));
    }
    validate_id(&cursor.group_id, "organization_group_cursor_invalid")?;
    Ok(cursor)
}

pub(super) fn encode_group_item_cursor(cursor: &OrganizationGroupItemCursor) -> String {
    serde_json::to_vec(cursor)
        .unwrap_or_default()
        .into_iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub(super) fn decode_group_item_cursor(
    value: &str,
) -> Result<OrganizationGroupItemCursor, DbError> {
    let cursor: OrganizationGroupItemCursor =
        decode_cursor_json(value, "organization_group_cursor_invalid")?;
    if cursor.version != ORGANIZATION_GROUP_CURSOR_VERSION
        || cursor.projection_fingerprint.is_empty()
        || cursor.projection_fingerprint.len() > 256
        || cursor
            .projection_fingerprint
            .chars()
            .any(|ch| ch.is_control())
    {
        return Err(DbError::Validation(
            "organization_group_cursor_invalid".to_string(),
        ));
    }
    validate_id(&cursor.group_id, "organization_group_cursor_invalid")?;
    validate_id(&cursor.id, "organization_group_cursor_invalid")?;
    if cursor.ordinal < 0 {
        return Err(DbError::Validation(
            "organization_group_cursor_invalid".to_string(),
        ));
    }
    Ok(cursor)
}

pub(super) fn validate_organization_projection_fingerprint(
    fingerprint: &str,
    code: &str,
) -> Result<(), DbError> {
    if fingerprint.is_empty()
        || fingerprint.len() > 256
        || fingerprint.chars().any(|ch| ch.is_control())
    {
        return Err(DbError::Validation(code.to_string()));
    }
    Ok(())
}

fn decode_cursor_json<T>(value: &str, code: &str) -> Result<T, DbError>
where
    T: for<'de> Deserialize<'de>,
{
    if value.is_empty() || value.len() > 2048 || !value.len().is_multiple_of(2) {
        return Err(DbError::Validation(code.to_string()));
    }
    let bytes = (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| DbError::Validation(code.to_string()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    serde_json::from_slice(&bytes).map_err(|_| DbError::Validation(code.to_string()))
}
