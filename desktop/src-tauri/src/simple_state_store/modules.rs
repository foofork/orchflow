// Module management operations

use super::connection::ConnectionManager;
use super::types::{CreateModule, Module, UpdateModule};
use chrono::Utc;
use rusqlite::{params, OptionalExtension, Result as SqliteResult};
use uuid::Uuid;

pub struct ModuleRepository {
    conn_manager: ConnectionManager,
}

impl ModuleRepository {
    pub fn new(conn_manager: ConnectionManager) -> Self {
        Self { conn_manager }
    }

    /// Install a new module
    pub async fn install_module(&self, create_module: CreateModule) -> SqliteResult<Module> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();

        let conn = self.conn_manager.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO modules (id, name, version, manifest, installed_at, enabled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id,
                create_module.name,
                create_module.version,
                create_module.manifest,
                now,
                create_module.enabled
            ],
        )?;

        Ok(Module {
            id,
            name: create_module.name,
            version: create_module.version,
            manifest: create_module.manifest,
            installed_at: now,
            enabled: create_module.enabled,
        })
    }

    /// Get a module by ID
    pub async fn get_module(&self, module_id: &str) -> SqliteResult<Option<Module>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, version, manifest, installed_at, enabled
             FROM modules WHERE id = ?1",
            params![module_id],
            |row| {
                Ok(Module {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    version: row.get(2)?,
                    manifest: row.get(3)?,
                    installed_at: row.get(4)?,
                    enabled: row.get(5)?,
                })
            },
        )
        .optional()
    }

    /// Get a module by name
    pub async fn get_module_by_name(&self, name: &str) -> SqliteResult<Option<Module>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, version, manifest, installed_at, enabled
             FROM modules WHERE name = ?1",
            params![name],
            |row| {
                Ok(Module {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    version: row.get(2)?,
                    manifest: row.get(3)?,
                    installed_at: row.get(4)?,
                    enabled: row.get(5)?,
                })
            },
        )
        .optional()
    }

    /// List all modules
    pub async fn list_modules(&self) -> SqliteResult<Vec<Module>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, version, manifest, installed_at, enabled
             FROM modules ORDER BY installed_at DESC",
        )?;

        let module_iter = stmt.query_map([], |row| {
            Ok(Module {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                manifest: row.get(3)?,
                installed_at: row.get(4)?,
                enabled: row.get(5)?,
            })
        })?;

        let mut modules = Vec::new();
        for module in module_iter {
            modules.push(module?);
        }

        Ok(modules)
    }

    /// List enabled modules
    pub async fn list_enabled_modules(&self) -> SqliteResult<Vec<Module>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, version, manifest, installed_at, enabled
             FROM modules WHERE enabled = 1 ORDER BY name",
        )?;

        let module_iter = stmt.query_map([], |row| {
            Ok(Module {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                manifest: row.get(3)?,
                installed_at: row.get(4)?,
                enabled: row.get(5)?,
            })
        })?;

        let mut modules = Vec::new();
        for module in module_iter {
            modules.push(module?);
        }

        Ok(modules)
    }

    /// Update a module
    pub async fn update_module(
        &self,
        module_id: &str,
        update_module: UpdateModule,
    ) -> SqliteResult<Option<Module>> {
        let conn = self.conn_manager.conn.lock().unwrap();

        // Build dynamic update query
        let mut set_clauses = Vec::new();
        let mut param_values = Vec::new();

        if let Some(version) = &update_module.version {
            set_clauses.push("version = ?");
            param_values.push(version.clone());
        }

        if let Some(manifest) = &update_module.manifest {
            set_clauses.push("manifest = ?");
            param_values.push(manifest.clone());
        }

        if let Some(enabled) = update_module.enabled {
            set_clauses.push("enabled = ?");
            param_values.push(if enabled {
                "1".to_string()
            } else {
                "0".to_string()
            });
        }

        if set_clauses.is_empty() {
            return self.get_module(module_id).await;
        }

        param_values.push(module_id.to_string());

        let query = format!("UPDATE modules SET {} WHERE id = ?", set_clauses.join(", "));

        // Convert to parameter array for rusqlite
        let params: Vec<&dyn rusqlite::ToSql> = param_values
            .iter()
            .map(|v| v as &dyn rusqlite::ToSql)
            .collect();
        let rows_affected = conn.execute(&query, &params[..])?;

        if rows_affected > 0 {
            self.get_module(module_id).await
        } else {
            Ok(None)
        }
    }

    /// Uninstall a module
    pub async fn uninstall_module(&self, module_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected =
            conn.execute("DELETE FROM modules WHERE id = ?1", params![module_id])?;

        Ok(rows_affected > 0)
    }

    /// Uninstall module by name
    pub async fn uninstall_module_by_name(&self, name: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute("DELETE FROM modules WHERE name = ?1", params![name])?;

        Ok(rows_affected > 0)
    }

    /// Enable a module
    pub async fn enable_module(&self, module_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE modules SET enabled = 1 WHERE id = ?1",
            params![module_id],
        )?;

        Ok(rows_affected > 0)
    }

    /// Disable a module
    pub async fn disable_module(&self, module_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE modules SET enabled = 0 WHERE id = ?1",
            params![module_id],
        )?;

        Ok(rows_affected > 0)
    }

    /// Enable module by name
    pub async fn enable_module_by_name(&self, name: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE modules SET enabled = 1 WHERE name = ?1",
            params![name],
        )?;

        Ok(rows_affected > 0)
    }

    /// Disable module by name
    pub async fn disable_module_by_name(&self, name: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE modules SET enabled = 0 WHERE name = ?1",
            params![name],
        )?;

        Ok(rows_affected > 0)
    }

    /// Check if module exists
    pub async fn module_exists(&self, module_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM modules WHERE id = ?1",
            params![module_id],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// Check if module name exists
    pub async fn module_name_exists(&self, name: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM modules WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// Check if module is enabled
    pub async fn is_module_enabled(&self, module_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let enabled: Option<bool> = conn
            .query_row(
                "SELECT enabled FROM modules WHERE id = ?1",
                params![module_id],
                |row| row.get(0),
            )
            .optional()?;

        Ok(enabled.unwrap_or(false))
    }

    /// Get module count
    pub async fn get_module_count(&self) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM modules", [], |row| row.get(0))?;

        Ok(count as usize)
    }

    /// Get enabled module count
    pub async fn get_enabled_module_count(&self) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM modules WHERE enabled = 1",
            [],
            |row| row.get(0),
        )?;

        Ok(count as usize)
    }

    /// Update module version
    pub async fn update_module_version(
        &self,
        module_id: &str,
        version: &str,
    ) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE modules SET version = ?1 WHERE id = ?2",
            params![version, module_id],
        )?;

        Ok(rows_affected > 0)
    }

    /// Search modules by name pattern
    pub async fn search_modules(&self, pattern: &str) -> SqliteResult<Vec<Module>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let search_pattern = format!("%{}%", pattern);
        let mut stmt = conn.prepare(
            "SELECT id, name, version, manifest, installed_at, enabled
             FROM modules WHERE name LIKE ?1 ORDER BY name",
        )?;

        let module_iter = stmt.query_map(params![search_pattern], |row| {
            Ok(Module {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                manifest: row.get(3)?,
                installed_at: row.get(4)?,
                enabled: row.get(5)?,
            })
        })?;

        let mut modules = Vec::new();
        for module in module_iter {
            modules.push(module?);
        }

        Ok(modules)
    }
}

impl Clone for ModuleRepository {
    fn clone(&self) -> Self {
        Self {
            conn_manager: self.conn_manager.clone(),
        }
    }
}
