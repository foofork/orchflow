// Database connection management and initialization

use rusqlite::{Connection, Result as SqliteResult};
use std::sync::{Arc, Mutex};
use std::path::Path;

pub struct ConnectionManager {
    pub conn: Arc<Mutex<Connection>>,
}

impl ConnectionManager {
    /// Create a new connection manager with in-memory database
    pub fn new() -> SqliteResult<Self> {
        let conn = Connection::open_in_memory()?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
    
    /// Create a new connection manager with file-based database
    pub fn new_with_file<P: AsRef<Path>>(path: P) -> SqliteResult<Self> {
        let conn = Connection::open(path)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
    
    /// Initialize the database schema
    pub fn initialize_schema(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        
        // Create sessions table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                tmux_session TEXT,
                created_at DATETIME NOT NULL,
                last_active DATETIME NOT NULL,
                metadata TEXT
            )",
            [],
        )?;
        
        // Create panes table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS panes (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                tmux_pane TEXT,
                pane_type TEXT NOT NULL,
                content TEXT,
                metadata TEXT,
                created_at DATETIME NOT NULL,
                FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )",
            [],
        )?;
        
        // Create layouts table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS layouts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                name TEXT NOT NULL,
                layout_data TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )",
            [],
        )?;
        
        // Create modules table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS modules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                version TEXT NOT NULL,
                manifest TEXT NOT NULL,
                installed_at DATETIME NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT 1
            )",
            [],
        )?;
        
        // Create key-value store table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS key_value_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )",
            [],
        )?;
        
        // Create indexes for better performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_panes_session_id ON panes(session_id)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_layouts_session_id ON layouts(session_id)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_layouts_active ON layouts(is_active)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_modules_enabled ON modules(enabled)",
            [],
        )?;
        
        Ok(())
    }
    
    /// Enable foreign key constraints
    pub fn enable_foreign_keys(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        Ok(())
    }
    
    /// Set WAL mode for better concurrent access
    pub fn enable_wal_mode(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("PRAGMA journal_mode = WAL", [])?;
        Ok(())
    }
    
    /// Optimize database settings
    pub fn optimize_settings(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        
        // Set synchronous mode to normal for better performance
        conn.execute("PRAGMA synchronous = NORMAL", [])?;
        
        // Increase cache size to 64MB
        conn.execute("PRAGMA cache_size = -65536", [])?;
        
        // Set temp store to memory
        conn.execute("PRAGMA temp_store = MEMORY", [])?;
        
        // Set mmap size to 256MB
        conn.execute("PRAGMA mmap_size = 268435456", [])?;
        
        Ok(())
    }
    
    /// Get database statistics
    pub fn get_stats(&self) -> SqliteResult<DatabaseStats> {
        let conn = self.conn.lock().unwrap();
        
        let session_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sessions",
            [],
            |row| row.get(0),
        )?;
        
        let pane_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM panes",
            [],
            |row| row.get(0),
        )?;
        
        let layout_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM layouts",
            [],
            |row| row.get(0),
        )?;
        
        let module_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM modules WHERE enabled = 1",
            [],
            |row| row.get(0),
        )?;
        
        let kv_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM key_value_store",
            [],
            |row| row.get(0),
        )?;
        
        Ok(DatabaseStats {
            sessions: session_count as usize,
            panes: pane_count as usize,
            layouts: layout_count as usize,
            enabled_modules: module_count as usize,
            key_value_pairs: kv_count as usize,
        })
    }
    
    /// Run database vacuum
    pub fn vacuum(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("VACUUM", [])?;
        Ok(())
    }
    
    /// Check database integrity
    pub fn check_integrity(&self) -> SqliteResult<bool> {
        let conn = self.conn.lock().unwrap();
        let result: String = conn.query_row(
            "PRAGMA integrity_check",
            [],
            |row| row.get(0),
        )?;
        
        Ok(result == "ok")
    }
}

#[derive(Debug)]
pub struct DatabaseStats {
    pub sessions: usize,
    pub panes: usize,
    pub layouts: usize,
    pub enabled_modules: usize,
    pub key_value_pairs: usize,
}

impl Clone for ConnectionManager {
    fn clone(&self) -> Self {
        Self {
            conn: self.conn.clone(),
        }
    }
}