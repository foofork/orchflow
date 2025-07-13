// Settings management

use super::persistence::PersistenceManager;
use crate::error::{OrchflowError, Result};

pub struct SettingsManager {
    persistence: PersistenceManager,
}

impl SettingsManager {
    pub fn new(persistence: PersistenceManager) -> Self {
        Self { persistence }
    }

    /// Set a setting value
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        // Validate setting key and value
        self.validate_setting(key, value).await?;

        // Save to storage
        self.persistence.save_setting(key, value).await?;

        Ok(())
    }

    /// Get a setting value
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        self.persistence.load_setting(key).await
    }

    /// Delete a setting
    pub async fn delete_setting(&self, key: &str) -> Result<()> {
        self.persistence.delete_setting(key).await
    }

    /// Get all settings with a prefix
    pub async fn get_settings_with_prefix(&self, prefix: &str) -> Result<Vec<(String, String)>> {
        // This would require extending SimpleStateStore to support prefix queries
        // For now, return empty - this is a future enhancement
        Ok(Vec::new())
    }

    /// Validate setting key and value
    async fn validate_setting(&self, key: &str, value: &str) -> Result<()> {
        if key.is_empty() {
            return Err(OrchflowError::validation_error(
                "setting_key",
                "Setting key cannot be empty",
            ));
        }

        if key.contains(':') {
            return Err(OrchflowError::validation_error(
                "setting_key",
                "Setting key cannot contain colon character (reserved for internal use)",
            ));
        }

        if value.len() > 10_000 {
            return Err(OrchflowError::validation_error(
                "setting_value",
                "Setting value cannot exceed 10,000 characters",
            ));
        }

        Ok(())
    }

    /// Set multiple settings in batch
    pub async fn set_settings_batch(&self, settings: &[(&str, &str)]) -> Result<()> {
        for (key, value) in settings {
            self.set_setting(key, value).await?;
        }
        Ok(())
    }

    /// Common setting operations
    pub async fn set_theme(&self, theme: &str) -> Result<()> {
        self.set_setting("ui.theme", theme).await
    }

    pub async fn get_theme(&self) -> Result<String> {
        Ok(self
            .get_setting("ui.theme")
            .await?
            .unwrap_or_else(|| "dark".to_string()))
    }

    pub async fn set_editor_font_size(&self, size: u32) -> Result<()> {
        self.set_setting("editor.font_size", &size.to_string())
            .await
    }

    pub async fn get_editor_font_size(&self) -> Result<u32> {
        let size_str = self
            .get_setting("editor.font_size")
            .await?
            .unwrap_or_else(|| "14".to_string());
        size_str
            .parse()
            .map_err(|_| OrchflowError::validation_error("font_size", "Invalid font size"))
    }

    pub async fn set_terminal_shell(&self, shell: &str) -> Result<()> {
        self.set_setting("terminal.default_shell", shell).await
    }

    pub async fn get_terminal_shell(&self) -> Result<String> {
        Ok(self
            .get_setting("terminal.default_shell")
            .await?
            .unwrap_or_else(|| "bash".to_string()))
    }

    pub async fn set_auto_save(&self, enabled: bool) -> Result<()> {
        self.set_setting("editor.auto_save", &enabled.to_string())
            .await
    }

    pub async fn get_auto_save(&self) -> Result<bool> {
        let enabled_str = self
            .get_setting("editor.auto_save")
            .await?
            .unwrap_or_else(|| "true".to_string());
        enabled_str
            .parse()
            .map_err(|_| OrchflowError::validation_error("auto_save", "Invalid boolean value"))
    }
}
