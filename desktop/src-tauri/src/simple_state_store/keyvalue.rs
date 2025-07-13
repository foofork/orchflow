// Key-value store operations

use super::connection::ConnectionManager;
use super::types::KeyValue;
use chrono::Utc;
use rusqlite::{params, OptionalExtension, Result as SqliteResult};

pub struct KeyValueRepository {
    conn_manager: ConnectionManager,
}

impl KeyValueRepository {
    pub fn new(conn_manager: ConnectionManager) -> Self {
        Self { conn_manager }
    }

    /// Set a key-value pair
    pub async fn set(&self, key: &str, value: &str) -> SqliteResult<()> {
        let now = Utc::now().naive_utc();

        let conn = self.conn_manager.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO key_value_store (key, value, created_at, updated_at)
             VALUES (?1, ?2, 
                COALESCE((SELECT created_at FROM key_value_store WHERE key = ?1), ?3),
                ?3
             )",
            params![key, value, now],
        )?;

        Ok(())
    }

    /// Get a value by key
    pub async fn get(&self, key: &str) -> SqliteResult<Option<String>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT value FROM key_value_store WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
    }

    /// Get a key-value pair with metadata
    pub async fn get_with_metadata(&self, key: &str) -> SqliteResult<Option<KeyValue>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT key, value, created_at, updated_at FROM key_value_store WHERE key = ?1",
            params![key],
            |row| {
                Ok(KeyValue {
                    key: row.get(0)?,
                    value: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        )
        .optional()
    }

    /// Delete a key-value pair
    pub async fn delete(&self, key: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected =
            conn.execute("DELETE FROM key_value_store WHERE key = ?1", params![key])?;

        Ok(rows_affected > 0)
    }

    /// Check if a key exists
    pub async fn exists(&self, key: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM key_value_store WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// List all keys
    pub async fn keys(&self) -> SqliteResult<Vec<String>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key FROM key_value_store ORDER BY key")?;

        let key_iter = stmt.query_map([], |row| Ok(row.get::<_, String>(0)?))?;

        let mut keys = Vec::new();
        for key in key_iter {
            keys.push(key?);
        }

        Ok(keys)
    }

    /// List keys with a specific prefix
    pub async fn keys_with_prefix(&self, prefix: &str) -> SqliteResult<Vec<String>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let pattern = format!("{}%", prefix);
        let mut stmt =
            conn.prepare("SELECT key FROM key_value_store WHERE key LIKE ?1 ORDER BY key")?;

        let key_iter = stmt.query_map(params![pattern], |row| Ok(row.get::<_, String>(0)?))?;

        let mut keys = Vec::new();
        for key in key_iter {
            keys.push(key?);
        }

        Ok(keys)
    }

    /// List all key-value pairs
    pub async fn list_all(&self) -> SqliteResult<Vec<KeyValue>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT key, value, created_at, updated_at FROM key_value_store ORDER BY key",
        )?;

        let kv_iter = stmt.query_map([], |row| {
            Ok(KeyValue {
                key: row.get(0)?,
                value: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut pairs = Vec::new();
        for pair in kv_iter {
            pairs.push(pair?);
        }

        Ok(pairs)
    }

    /// List key-value pairs with a specific prefix
    pub async fn list_with_prefix(&self, prefix: &str) -> SqliteResult<Vec<KeyValue>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let pattern = format!("{}%", prefix);
        let mut stmt = conn.prepare(
            "SELECT key, value, created_at, updated_at FROM key_value_store WHERE key LIKE ?1 ORDER BY key"
        )?;

        let kv_iter = stmt.query_map(params![pattern], |row| {
            Ok(KeyValue {
                key: row.get(0)?,
                value: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut pairs = Vec::new();
        for pair in kv_iter {
            pairs.push(pair?);
        }

        Ok(pairs)
    }

    /// Clear all key-value pairs
    pub async fn clear_all(&self) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute("DELETE FROM key_value_store", [])?;

        Ok(rows_affected)
    }

    /// Clear key-value pairs with a specific prefix
    pub async fn clear_with_prefix(&self, prefix: &str) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let pattern = format!("{}%", prefix);
        let rows_affected = conn.execute(
            "DELETE FROM key_value_store WHERE key LIKE ?1",
            params![pattern],
        )?;

        Ok(rows_affected)
    }

    /// Get the count of stored key-value pairs
    pub async fn count(&self) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM key_value_store", [], |row| row.get(0))?;

        Ok(count as usize)
    }

    /// Get the count of key-value pairs with a specific prefix
    pub async fn count_with_prefix(&self, prefix: &str) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let pattern = format!("{}%", prefix);
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM key_value_store WHERE key LIKE ?1",
            params![pattern],
            |row| row.get(0),
        )?;

        Ok(count as usize)
    }

    /// Set multiple key-value pairs in a batch operation
    pub async fn set_batch(&self, pairs: &[(&str, &str)]) -> SqliteResult<()> {
        let now = Utc::now().naive_utc();
        let conn = self.conn_manager.conn.lock().unwrap();

        let tx = conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO key_value_store (key, value, created_at, updated_at)
                 VALUES (?1, ?2, 
                    COALESCE((SELECT created_at FROM key_value_store WHERE key = ?1), ?3),
                    ?3
                 )",
            )?;

            for (key, value) in pairs {
                stmt.execute(params![key, value, now])?;
            }
        }
        tx.commit()?;

        Ok(())
    }

    /// Get multiple values by keys
    pub async fn get_batch(&self, keys: &[&str]) -> SqliteResult<Vec<(String, Option<String>)>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut results = Vec::new();

        for &key in keys {
            let value = conn
                .query_row(
                    "SELECT value FROM key_value_store WHERE key = ?1",
                    params![key],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;

            results.push((key.to_string(), value));
        }

        Ok(results)
    }

    /// Delete multiple keys in a batch operation
    pub async fn delete_batch(&self, keys: &[&str]) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut total_deleted = 0;

        let tx = conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare("DELETE FROM key_value_store WHERE key = ?1")?;

            for &key in keys {
                let rows_affected = stmt.execute(params![key])?;
                total_deleted += rows_affected;
            }
        }
        tx.commit()?;

        Ok(total_deleted)
    }
}

impl Clone for KeyValueRepository {
    fn clone(&self) -> Self {
        Self {
            conn_manager: self.conn_manager.clone(),
        }
    }
}
