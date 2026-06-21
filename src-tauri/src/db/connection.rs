use super::schema::migrate;
use super::*;
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone)]
pub struct Database {
    path: PathBuf,
    pool: Pool<SqliteConnectionManager>,
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

        Ok(Self { path, pool })
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
}

fn configure_connection(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(())
}
