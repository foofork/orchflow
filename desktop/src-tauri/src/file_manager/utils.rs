// Utility functions for file manager

use crate::error::{OrchflowError, Result};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader};

/// Get a preview of a file's contents
pub async fn get_file_preview(path: &Path, max_lines: usize, max_file_size: u64) -> Result<String> {
    let metadata = fs::metadata(path)
        .await
        .map_err(|e| OrchflowError::FileOperationError {
            path: path.to_path_buf(),
            operation: "read metadata".to_string(),
            reason: e.to_string(),
        })?;

    if metadata.len() > max_file_size {
        return Ok(format!(
            "File too large to preview ({} bytes)",
            metadata.len()
        ));
    }

    let file = fs::File::open(path)
        .await
        .map_err(|e| OrchflowError::FileOperationError {
            path: path.to_path_buf(),
            operation: "open file".to_string(),
            reason: e.to_string(),
        })?;

    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    let mut preview = Vec::new();
    let mut line_count = 0;

    while let Some(line) =
        lines
            .next_line()
            .await
            .map_err(|e| OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "read line".to_string(),
                reason: e.to_string(),
            })?
    {
        preview.push(line);
        line_count += 1;

        if line_count >= max_lines {
            break;
        }
    }

    Ok(preview.join("\n"))
}

/// Search for files matching a pattern
pub async fn search_files(
    pattern: &str,
    search_path: &Path,
    project_root: &Path,
) -> Result<Vec<PathBuf>> {
    let search_root = if search_path.starts_with(project_root) {
        search_path
    } else {
        project_root
    };

    let mut results = Vec::new();
    let pattern_lower = pattern.to_lowercase();

    // Use a stack for iterative directory traversal
    let mut stack = vec![search_root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let mut entries = match fs::read_dir(&dir).await {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        while let Some(entry) = entries.next_entry().await.ok().flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip hidden files
            if name.starts_with('.') && name != ".gitignore" {
                continue;
            }

            // Check if name matches pattern
            if name.to_lowercase().contains(&pattern_lower) {
                results.push(path.clone());
            }

            // Add directories to stack for traversal
            if path.is_dir() {
                stack.push(path);
            }
        }
    }

    // Sort results
    results.sort();

    Ok(results)
}

/// Get the relative path from a base path
pub fn get_relative_path(path: &Path, base: &Path) -> Option<PathBuf> {
    path.strip_prefix(base).ok().map(|p| p.to_path_buf())
}

/// Check if a path is safe (within project root)
pub fn is_safe_path(path: &Path, project_root: &Path) -> bool {
    path.starts_with(project_root)
}

/// Get file extension
pub fn get_file_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
}

/// Determine if a file is likely binary based on extension
pub fn is_binary_file(path: &Path) -> bool {
    let binary_extensions = [
        "exe", "dll", "so", "dylib", "a", "o", "obj", "zip", "tar", "gz", "bz2", "7z", "rar",
        "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "mp3", "mp4", "avi", "mkv", "mov",
        "flv", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "db", "sqlite", "sqlite3",
    ];

    if let Some(ext) = get_file_extension(path) {
        binary_extensions.contains(&ext.as_str())
    } else {
        false
    }
}
