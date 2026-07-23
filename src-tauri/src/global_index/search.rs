use super::models::GlobalSearchResult;
use crate::db::{Database, DbError};

/// Global search is intentionally a separate entry point from the library
/// query.  It never accepts `LibraryScope` and never joins the AI `files`
/// table, so a Spotlight query cannot accidentally widen an AI operation.
pub fn search_global_entries(
    db: &Database,
    query: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    db.search_global_entries(query, limit, offset)
}
