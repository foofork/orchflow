use std::env;
use std::path::PathBuf;

/// Replacement for directories crate using platform-specific conventions
pub struct AppDirs {
    qualifier: String,
    organization: String,
    application: String,
}

impl AppDirs {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            qualifier: "com".to_string(),
            organization: "orchflow".to_string(),
            application: "orchflow".to_string(),
        })
    }

    /// Get the data directory for the application
    pub fn data_dir(&self) -> Option<PathBuf> {
        #[cfg(target_os = "macos")]
        {
            home::home_dir().map(|h| {
                h.join("Library")
                    .join("Application Support")
                    .join(&self.organization)
                    .join(&self.application)
            })
        }

        #[cfg(target_os = "linux")]
        {
            env::var_os("XDG_DATA_HOME")
                .map(PathBuf::from)
                .or_else(|| home::home_dir().map(|h| h.join(".local").join("share")))
                .map(|d| d.join(&self.application))
        }

        #[cfg(target_os = "windows")]
        {
            env::var_os("APPDATA")
                .map(PathBuf::from)
                .map(|d| d.join(&self.organization).join(&self.application))
        }
    }

    /// Get the config directory for the application
    pub fn config_dir(&self) -> Option<PathBuf> {
        #[cfg(target_os = "macos")]
        {
            self.data_dir() // macOS uses same dir for config and data
        }

        #[cfg(target_os = "linux")]
        {
            env::var_os("XDG_CONFIG_HOME")
                .map(PathBuf::from)
                .or_else(|| home::home_dir().map(|h| h.join(".config")))
                .map(|d| d.join(&self.application))
        }

        #[cfg(target_os = "windows")]
        {
            self.data_dir() // Windows uses same dir for config and data
        }
    }

    /// Get the cache directory for the application
    pub fn cache_dir(&self) -> Option<PathBuf> {
        #[cfg(target_os = "macos")]
        {
            home::home_dir().map(|h| {
                h.join("Library")
                    .join("Caches")
                    .join(&self.organization)
                    .join(&self.application)
            })
        }

        #[cfg(target_os = "linux")]
        {
            env::var_os("XDG_CACHE_HOME")
                .map(PathBuf::from)
                .or_else(|| home::home_dir().map(|h| h.join(".cache")))
                .map(|d| d.join(&self.application))
        }

        #[cfg(target_os = "windows")]
        {
            env::var_os("LOCALAPPDATA").map(PathBuf::from).map(|d| {
                d.join(&self.organization)
                    .join(&self.application)
                    .join("cache")
            })
        }
    }

    /// Get a specific subdirectory in the data directory
    pub fn data_subdir(&self, subdir: &str) -> Option<PathBuf> {
        self.data_dir().map(|d| d.join(subdir))
    }
}

/// For compatibility with existing code
pub fn get_project_dirs() -> Result<AppDirs, Box<dyn std::error::Error>> {
    AppDirs::new()
}

/// Get the modules directory for storing orchflow modules
pub fn get_modules_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_dirs = AppDirs::new()?;
    app_dirs
        .data_subdir("modules")
        .ok_or_else(|| "Could not determine modules directory".into())
}
