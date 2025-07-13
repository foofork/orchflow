// Text replacement functionality

use super::matcher::MatcherBuilder;
use super::types::{ReplaceRequest, ReplaceResult};
use std::path::Path;
use tokio::fs;

pub struct TextReplacer;

impl TextReplacer {
    /// Replace text in a single file
    pub async fn replace_in_file(
        &self,
        file_path: &Path,
        request: &ReplaceRequest,
    ) -> Result<ReplaceResult, String> {
        // Read file content
        let content = fs::read_to_string(file_path)
            .await
            .map_err(|e| format!("Failed to read file {}: {}", file_path.display(), e))?;

        // Create regex for replacement
        let regex = MatcherBuilder::build_simple_regex(&request.query, &request.options)?;

        // Perform replacement
        let (new_content, replacements_made) =
            self.perform_replacement(&content, &regex, &request.replacement);

        let result = ReplaceResult {
            file_path: file_path.to_string_lossy().to_string(),
            replacements_made,
            preview: if request.dry_run {
                Some(self.generate_preview(&content, &new_content, replacements_made))
            } else {
                None
            },
        };

        // Write back to file if not a dry run
        if !request.dry_run && replacements_made > 0 {
            fs::write(file_path, new_content)
                .await
                .map_err(|e| format!("Failed to write file {}: {}", file_path.display(), e))?;
        }

        Ok(result)
    }

    /// Replace text in multiple files
    pub async fn replace_in_files(
        &self,
        file_paths: &[&Path],
        request: &ReplaceRequest,
    ) -> Result<Vec<ReplaceResult>, String> {
        let mut results = Vec::new();

        for &file_path in file_paths {
            match self.replace_in_file(file_path, request).await {
                Ok(result) => {
                    if result.replacements_made > 0 {
                        results.push(result);
                    }
                }
                Err(e) => {
                    eprintln!("Error replacing in {}: {}", file_path.display(), e);
                    // Continue with other files
                }
            }
        }

        Ok(results)
    }

    /// Perform the actual text replacement
    fn perform_replacement(
        &self,
        content: &str,
        regex: &regex::Regex,
        replacement: &str,
    ) -> (String, usize) {
        let mut count = 0;
        let new_content = regex.replace_all(content, |_caps: &regex::Captures| {
            count += 1;
            replacement
        });

        (new_content.to_string(), count)
    }

    /// Generate a preview showing changes
    fn generate_preview(
        &self,
        old_content: &str,
        new_content: &str,
        replacements: usize,
    ) -> String {
        if replacements == 0 {
            return "No changes made".to_string();
        }

        let old_lines: Vec<&str> = old_content.lines().collect();
        let new_lines: Vec<&str> = new_content.lines().collect();

        let mut preview = Vec::new();
        preview.push(format!(
            "--- Changes: {} replacements made ---",
            replacements
        ));

        // Simple diff preview - show first few changed lines
        let mut changes_shown = 0;
        let max_preview_lines = 10;

        for (i, (old_line, new_line)) in old_lines.iter().zip(new_lines.iter()).enumerate() {
            if old_line != new_line && changes_shown < max_preview_lines {
                preview.push(format!("Line {}: - {}", i + 1, old_line));
                preview.push(format!("Line {}: + {}", i + 1, new_line));
                changes_shown += 1;
            }
        }

        if changes_shown >= max_preview_lines {
            preview.push("... (more changes not shown)".to_string());
        }

        preview.join("\n")
    }

    /// Validate replacement operation before execution
    pub async fn validate_replacement(&self, request: &ReplaceRequest) -> Result<(), String> {
        // Check if the replacement would create invalid syntax
        if request.replacement.contains('\0') {
            return Err("Replacement text cannot contain null characters".to_string());
        }

        // Validate regex pattern
        MatcherBuilder::build_simple_regex(&request.query, &request.options)?;

        // Check if root path exists
        if !Path::new(&request.root_path).exists() {
            return Err(format!("Root path does not exist: {}", request.root_path));
        }

        Ok(())
    }

    /// Create a backup of files before replacement
    pub async fn backup_files(&self, file_paths: &[&Path]) -> Result<Vec<String>, String> {
        let mut backup_paths = Vec::new();

        for &file_path in file_paths {
            let backup_path = format!("{}.backup", file_path.to_string_lossy());

            fs::copy(file_path, &backup_path)
                .await
                .map_err(|e| format!("Failed to backup {}: {}", file_path.display(), e))?;

            backup_paths.push(backup_path);
        }

        Ok(backup_paths)
    }

    /// Restore files from backup
    pub async fn restore_from_backup(&self, backup_paths: &[String]) -> Result<(), String> {
        for backup_path in backup_paths {
            let original_path = backup_path.trim_end_matches(".backup");

            fs::copy(backup_path, original_path)
                .await
                .map_err(|e| format!("Failed to restore from backup {}: {}", backup_path, e))?;

            // Clean up backup file
            let _ = fs::remove_file(backup_path).await;
        }

        Ok(())
    }
}
