use rusqlite::{Connection, Result as SqliteResult, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use chrono::{Utc, NaiveDateTime, DateTime};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub tmux_session: Option<String>,
    pub created_at: NaiveDateTime,
    pub last_active: NaiveDateTime,
    pub metadata: Option<String>, // JSON
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Pane {
    pub id: String,
    pub session_id: String,
    pub tmux_pane: Option<String>,
    pub pane_type: String, // 'editor', 'terminal', 'repl'
    pub content: Option<String>, // scrollback cache
    pub metadata: Option<String>, // JSON
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Layout {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub layout_data: String, // JSON of GridLayout
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Module {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest: String, // JSON manifest
    pub installed_at: NaiveDateTime,
    pub enabled: bool,
}

pub struct SimpleStateStore {
    pub conn: Arc<Mutex<Connection>>,
    pub pool: Option<sqlx::Pool<sqlx::Sqlite>>,
}

impl SimpleStateStore {
    pub fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;
        
        // Create tables
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                tmux_session TEXT,
                created_at DATETIME NOT NULL,
                last_active DATETIME NOT NULL,
                metadata TEXT
            );
            
            CREATE TABLE IF NOT EXISTS panes (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                tmux_pane TEXT,
                pane_type TEXT NOT NULL,
                content TEXT,
                metadata TEXT,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            
            CREATE TABLE IF NOT EXISTS layouts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                name TEXT NOT NULL,
                layout_data TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS modules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                manifest TEXT NOT NULL,
                installed_at DATETIME NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT 1
            );
            
            CREATE TABLE IF NOT EXISTS test_suites (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                name TEXT NOT NULL,
                project_path TEXT NOT NULL,
                test_framework TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS test_runs (
                id TEXT PRIMARY KEY,
                suite_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                command TEXT NOT NULL,
                status TEXT NOT NULL,
                total_tests INTEGER NOT NULL DEFAULT 0,
                passed_tests INTEGER NOT NULL DEFAULT 0,
                failed_tests INTEGER NOT NULL DEFAULT 0,
                skipped_tests INTEGER NOT NULL DEFAULT 0,
                duration_ms INTEGER,
                coverage_percent REAL,
                error_output TEXT,
                started_at DATETIME NOT NULL,
                completed_at DATETIME,
                metadata TEXT
            );
            
            CREATE TABLE IF NOT EXISTS test_results (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                suite_id TEXT NOT NULL,
                test_file TEXT NOT NULL,
                test_name TEXT NOT NULL,
                test_path TEXT NOT NULL,
                status TEXT NOT NULL,
                duration_ms INTEGER,
                error_message TEXT,
                error_stack TEXT,
                assertion_results TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                metadata TEXT
            );
            
            CREATE TABLE IF NOT EXISTS command_history (
                id TEXT PRIMARY KEY,
                pane_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                command TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                working_dir TEXT,
                exit_code INTEGER,
                duration_ms INTEGER,
                shell_type TEXT,
                FOREIGN KEY (pane_id) REFERENCES panes(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_command_history_timestamp ON command_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_command_history_pane ON command_history(pane_id);
            CREATE INDEX IF NOT EXISTS idx_command_history_session ON command_history(session_id);
            CREATE INDEX IF NOT EXISTS idx_command_history_command ON command_history(command);
            
            CREATE TABLE IF NOT EXISTS test_coverage (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                lines_total INTEGER NOT NULL,
                lines_covered INTEGER NOT NULL,
                branches_total INTEGER NOT NULL,
                branches_covered INTEGER NOT NULL,
                functions_total INTEGER NOT NULL,
                functions_covered INTEGER NOT NULL,
                statements_total INTEGER NOT NULL,
                statements_covered INTEGER NOT NULL,
                uncovered_lines TEXT
            );
            
            CREATE VIEW IF NOT EXISTS test_history AS
            SELECT 
                tr.id,
                ts.name as suite_name,
                ts.project_path,
                tr.status,
                tr.total_tests,
                tr.passed_tests,
                tr.failed_tests,
                tr.duration_ms,
                tr.coverage_percent,
                tr.started_at,
                tr.completed_at
            FROM test_runs tr
            JOIN test_suites ts ON tr.suite_id = ts.id
            ORDER BY tr.started_at DESC;
            
            CREATE VIEW IF NOT EXISTS test_failure_trends AS
            SELECT 
                date(tr.started_at) as test_date,
                ts.name as suite_name,
                COUNT(*) as total_runs,
                SUM(CASE WHEN tr.status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
                AVG(CAST(tr.failed_tests AS REAL)) as avg_failed_tests,
                AVG(CAST(tr.duration_ms AS REAL)) as avg_duration_ms
            FROM test_runs tr
            JOIN test_suites ts ON tr.suite_id = ts.id
            WHERE tr.completed_at IS NOT NULL
            GROUP BY date(tr.started_at), ts.name
            ORDER BY test_date DESC;
            "#,
        )?;
        
        // Initialize SQLx pool synchronously using blocking runtime
        let db_path_owned = db_path.to_string();
        let pool = std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(&format!("sqlite:{}", db_path_owned))
                    .await
            })
        }).join().map_err(|_| "Failed to join SQLx initialization thread")?;
        
        let pool = match pool {
            Ok(p) => Some(p),
            Err(e) => {
                eprintln!("Warning: Failed to initialize SQLx pool: {}", e);
                None
            }
        };
        
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            pool,
        })
    }
    
    // Legacy session/pane methods removed - use StateManager instead
    
    // Settings methods
    pub fn get_setting(&self, key: &str) -> SqliteResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        
        let value = stmt.query_row(params![key], |row| row.get(0)).optional()?;
        Ok(value)
    }
    
    pub fn set_setting(&self, key: &str, value: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params![key, value, Utc::now().naive_utc()],
        )?;
        Ok(())
    }
    
    // ===== Async Methods for StateManager =====
    
    /// Save session state (async wrapper)
    pub async fn save_session(&self, session: &crate::state_manager::SessionState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let session_json = serde_json::to_string(&session.layout)?;
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT OR REPLACE INTO sessions (id, name, tmux_session, created_at, last_active, metadata) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                session.id,
                session.name,
                None::<String>, // tmux_session - legacy field
                session.created_at.naive_utc(),
                session.updated_at.naive_utc(),
                Some(session_json)
            ],
        )?;
        
        Ok(())
    }
    
    /// Save pane state (async wrapper)
    pub async fn save_pane(&self, pane: &crate::state_manager::PaneState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let pane_type_str = match &pane.pane_type {
            crate::state_manager::PaneType::Terminal => "terminal",
            crate::state_manager::PaneType::Editor => "editor",
            crate::state_manager::PaneType::FileTree => "file_tree",
            crate::state_manager::PaneType::Output => "output",
            crate::state_manager::PaneType::Custom(name) => name,
        };
        
        let metadata = serde_json::json!({
            "title": pane.title,
            "working_dir": pane.working_dir,
            "command": pane.command
        }).to_string();
        
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO panes (id, session_id, tmux_pane, pane_type, content, metadata, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                pane.id,
                pane.session_id,
                pane.backend_id,
                pane_type_str,
                None::<String>, // content - for future scrollback cache
                Some(metadata),
                pane.created_at.naive_utc()
            ],
        )?;
        
        Ok(())
    }
    
    /// List all sessions for StateManager (async wrapper)
    pub async fn list_sessions_for_state_manager(&self) -> Result<Vec<crate::state_manager::SessionState>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, tmux_session, created_at, last_active, metadata 
             FROM sessions ORDER BY last_active DESC"
        )?;
        
        let sessions = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let created_at: NaiveDateTime = row.get(3)?;
            let last_active: NaiveDateTime = row.get(4)?;
            let metadata: Option<String> = row.get(5)?;
            
            // Parse layout from metadata if it exists
            let layout = metadata
                .and_then(|json| serde_json::from_str(&json).ok());
            
            Ok(crate::state_manager::SessionState {
                id,
                name,
                panes: Vec::new(), // Will be populated by StateManager
                active_pane: None, // Will be populated by StateManager
                layout,
                created_at: DateTime::from_naive_utc_and_offset(created_at, Utc),
                updated_at: DateTime::from_naive_utc_and_offset(last_active, Utc),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        
        Ok(sessions)
    }
    
    /// List all panes for StateManager (async wrapper)
    pub async fn list_panes_for_state_manager(&self) -> Result<Vec<crate::state_manager::PaneState>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, tmux_pane, pane_type, content, metadata, created_at 
             FROM panes ORDER BY created_at"
        )?;
        
        let panes = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let session_id: String = row.get(1)?;
            let tmux_pane: Option<String> = row.get(2)?;
            let pane_type_str: String = row.get(3)?;
            let metadata: Option<String> = row.get(5)?;
            let created_at: NaiveDateTime = row.get(6)?;
            
            // Parse pane type
            let pane_type = match pane_type_str.as_str() {
                "terminal" => crate::state_manager::PaneType::Terminal,
                "editor" => crate::state_manager::PaneType::Editor,
                "file_tree" => crate::state_manager::PaneType::FileTree,
                "output" => crate::state_manager::PaneType::Output,
                other => crate::state_manager::PaneType::Custom(other.to_string()),
            };
            
            // Parse metadata for title, working_dir, command
            let (title, working_dir, command) = if let Some(meta_json) = metadata {
                if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&meta_json) {
                    (
                        meta.get("title").and_then(|v| v.as_str()).unwrap_or("Pane").to_string(),
                        meta.get("working_dir").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        meta.get("command").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    )
                } else {
                    ("Pane".to_string(), None, None)
                }
            } else {
                ("Pane".to_string(), None, None)
            };
            
            Ok(crate::state_manager::PaneState {
                id,
                session_id,
                backend_id: tmux_pane,
                pane_type,
                title,
                working_dir,
                command,
                created_at: DateTime::from_naive_utc_and_offset(created_at, Utc),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        
        Ok(panes)
    }
    
    /// Delete session (async wrapper)
    pub async fn delete_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.conn.lock().unwrap();
        
        // Delete associated panes first
        conn.execute("DELETE FROM panes WHERE session_id = ?1", params![session_id])?;
        
        // Delete session
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])?;
        
        Ok(())
    }
    
    /// Delete pane (async wrapper)
    pub async fn delete_pane(&self, pane_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM panes WHERE id = ?1", params![pane_id])?;
        Ok(())
    }
    
    // ===== Module Methods =====
    
    /// Install a module
    pub async fn install_module(&self, name: String, version: String, manifest: String) -> Result<Module, Box<dyn std::error::Error + Send + Sync>> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();
        
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO modules (id, name, version, manifest, installed_at, enabled) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, name, version, manifest, now, true],
        )?;
        
        Ok(Module {
            id,
            name,
            version,
            manifest,
            installed_at: now,
            enabled: true,
        })
    }
    
    /// List all modules
    pub async fn list_modules(&self) -> Result<Vec<Module>, Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, version, manifest, installed_at, enabled 
             FROM modules ORDER BY installed_at DESC"
        )?;
        
        let modules = stmt.query_map([], |row| {
            Ok(Module {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                manifest: row.get(3)?,
                installed_at: row.get(4)?,
                enabled: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        
        Ok(modules)
    }
}

// Make it cloneable for Tauri
impl Clone for SimpleStateStore {
    fn clone(&self) -> Self {
        Self {
            conn: self.conn.clone(),
            pool: self.pool.clone(),
        }
    }
}

impl SimpleStateStore {
    pub async fn initialize_sqlx_pool(&mut self, db_path: &str) -> Result<(), sqlx::Error> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&format!("sqlite:{}", db_path))
            .await?;
        self.pool = Some(pool);
        Ok(())
    }
    
    pub fn get_pool(&self) -> Option<&sqlx::Pool<sqlx::Sqlite>> {
        self.pool.as_ref()
    }
}