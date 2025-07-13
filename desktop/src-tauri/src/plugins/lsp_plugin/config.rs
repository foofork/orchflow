// Language server configurations

use super::types::LanguageServerConfig;
use serde_json::json;
use std::collections::HashMap;

pub fn default_server_configs() -> HashMap<String, LanguageServerConfig> {
    let mut configs = HashMap::new();

    // Rust Analyzer
    configs.insert(
        "rust".to_string(),
        LanguageServerConfig {
            name: "rust-analyzer".to_string(),
            command: "rust-analyzer".to_string(),
            args: vec![],
            file_extensions: vec!["rs".to_string()],
            root_markers: vec!["Cargo.toml".to_string(), "Cargo.lock".to_string()],
            initialization_options: Some(json!({
                "cargo": {
                    "buildScripts": {
                        "enable": true
                    }
                }
            })),
        },
    );

    // TypeScript Language Server
    configs.insert(
        "typescript".to_string(),
        LanguageServerConfig {
            name: "typescript-language-server".to_string(),
            command: "typescript-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            file_extensions: vec![
                "ts".to_string(),
                "tsx".to_string(),
                "js".to_string(),
                "jsx".to_string(),
            ],
            root_markers: vec!["package.json".to_string(), "tsconfig.json".to_string()],
            initialization_options: None,
        },
    );

    // Python Language Server (Pylsp)
    configs.insert(
        "python".to_string(),
        LanguageServerConfig {
            name: "pylsp".to_string(),
            command: "pylsp".to_string(),
            args: vec![],
            file_extensions: vec!["py".to_string()],
            root_markers: vec![
                "setup.py".to_string(),
                "pyproject.toml".to_string(),
                "requirements.txt".to_string(),
            ],
            initialization_options: None,
        },
    );

    // Go Language Server
    configs.insert(
        "go".to_string(),
        LanguageServerConfig {
            name: "gopls".to_string(),
            command: "gopls".to_string(),
            args: vec![],
            file_extensions: vec!["go".to_string()],
            root_markers: vec!["go.mod".to_string(), "go.sum".to_string()],
            initialization_options: None,
        },
    );

    configs
}

pub fn get_language_for_file(
    file_path: &str,
    configs: &HashMap<String, LanguageServerConfig>,
) -> Option<String> {
    let extension = std::path::Path::new(file_path).extension()?.to_str()?;

    for (language, config) in configs {
        if config.file_extensions.contains(&extension.to_string()) {
            return Some(language.clone());
        }
    }

    None
}
