use super::*;

pub(crate) fn resolve_execute_selections(
    db: &Database,
    request: ExecuteMovesByIdRequest,
) -> Result<ExecuteMovesRequest, String> {
    if request.operations.is_empty() {
        return Err("At least one authoritative preview ID is required.".to_string());
    }
    let file_ids = request
        .operations
        .iter()
        .map(|selection| selection.file_id.clone())
        .collect::<Vec<_>>();
    let previews = db
        .get_operation_previews_by_file_ids(&file_ids)
        .map_err(|error| error.to_string())?;
    let previews_by_file_id = previews
        .into_iter()
        .map(|preview| (preview.file_id.clone(), preview))
        .collect::<std::collections::HashMap<_, _>>();
    let mut operations = Vec::with_capacity(request.operations.len());
    for selection in request.operations {
        let preview = previews_by_file_id
            .get(&selection.file_id)
            .ok_or_else(|| format!("No authoritative preview exists for {}.", selection.id))?;
        if preview.id != selection.id || preview.is_executable == Some(false) {
            return Err(format!(
                "Invalid authoritative preview ID: {}.",
                selection.id
            ));
        }
        db.verify_indexed_file_identity(&selection.file_id)
            .map_err(|error| error.to_string())?;
        let (original_name, indexed_extension, is_dir) = db
            .get_indexed_file_naming(&selection.file_id)
            .map_err(|error| error.to_string())?;
        let mut new_name = normalize_proposed_file_name(
            &original_name,
            &indexed_extension,
            &preview.new_name,
            is_dir,
            ExtensionChangePolicy::Preserve,
        )?;
        validate_safe_file_name(&new_name)?;
        let mut target_path = preview.target_path.clone();
        if let Some(override_name) = selection.new_name {
            let normalized_override = normalize_proposed_file_name(
                &original_name,
                &indexed_extension,
                &override_name,
                is_dir,
                ExtensionChangePolicy::Preserve,
            )?;
            validate_safe_file_name(&normalized_override)?;
            let parent = Path::new(&target_path)
                .parent()
                .ok_or_else(|| "Authoritative preview target has no parent.".to_string())?;
            target_path = normalize_path(&parent.join(&normalized_override));
            new_name = normalized_override;
        }
        operations.push(OperationPreviewRequest {
            id: preview.id.clone(),
            file_id: preview.file_id.clone(),
            operation_type: preview.operation_type.clone(),
            source_path: preview.source_path.clone(),
            target_path,
            old_name: preview.old_name.clone(),
            new_name,
            is_executable: preview.is_executable,
        });
    }
    Ok(ExecuteMovesRequest { operations })
}
