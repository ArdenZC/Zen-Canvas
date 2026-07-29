use super::schema::migrate;
use super::*;
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::{
    collections::VecDeque,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

const LIBRARY_COUNT_CACHE_MAX_ENTRIES: usize = 32;

struct LibraryCountCacheEntry {
    revision: i64,
    membership_fingerprint: String,
    total_count: i64,
}

#[derive(Clone)]
pub struct Database {
    path: PathBuf,
    pool: Pool<SqliteConnectionManager>,
    library_count_cache: Arc<Mutex<VecDeque<LibraryCountCacheEntry>>>,
}

impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, DbError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let manager = SqliteConnectionManager::file(&path).with_init(configure_connection);
        let pool = Pool::builder().max_size(8).build(manager)?;
        {
            let conn = pool.get()?;
            migrate(&conn)?;
        }

        Ok(Self {
            path,
            pool,
            library_count_cache: Arc::new(Mutex::new(VecDeque::new())),
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn init(&self) -> Result<(), DbError> {
        let conn = self.conn()?;
        migrate(&conn)
    }

    pub(crate) fn conn(&self) -> Result<PooledConnection<SqliteConnectionManager>, DbError> {
        self.pool.get().map_err(DbError::from)
    }

    pub(crate) fn cached_library_count(
        &self,
        revision: i64,
        membership_fingerprint: &str,
    ) -> Option<i64> {
        let mut cache = self
            .library_count_cache
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let index = cache.iter().position(|entry| {
            entry.revision == revision && entry.membership_fingerprint == membership_fingerprint
        })?;
        let entry = cache.remove(index)?;
        let total_count = entry.total_count;
        cache.push_back(entry);
        Some(total_count)
    }

    pub(crate) fn cache_library_count(
        &self,
        revision: i64,
        membership_fingerprint: String,
        total_count: i64,
    ) {
        let mut cache = self
            .library_count_cache
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        cache.retain(|entry| {
            entry.revision != revision || entry.membership_fingerprint != membership_fingerprint
        });
        cache.push_back(LibraryCountCacheEntry {
            revision,
            membership_fingerprint,
            total_count,
        });
        while cache.len() > LIBRARY_COUNT_CACHE_MAX_ENTRIES {
            cache.pop_front();
        }
    }
}

fn configure_connection(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    conn.pragma_update(None, "mmap_size", 3_000_000_000_i64)?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(())
}
