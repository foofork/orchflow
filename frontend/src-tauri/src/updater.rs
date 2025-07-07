use tauri::{AppHandle, Manager, Runtime};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
pub struct UpdateStatus {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f32,
}

pub struct UpdaterState {
    pub checking: Arc<Mutex<bool>>,
    pub downloading: Arc<Mutex<bool>>,
}

impl UpdaterState {
    pub fn new() -> Self {
        Self {
            checking: Arc::new(Mutex::new(false)),
            downloading: Arc::new(Mutex::new(false)),
        }
    }
}

/// Check for updates
#[tauri::command]
pub async fn check_for_update<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, UpdaterState>,
) -> Result<UpdateStatus, String> {
    // Prevent concurrent update checks
    let mut checking = state.checking.lock().await;
    if *checking {
        return Err("Update check already in progress".to_string());
    }
    *checking = true;
    drop(checking);

    let result = perform_update_check(app.clone()).await;
    
    // Reset checking flag
    let mut checking = state.checking.lock().await;
    *checking = false;
    drop(checking);
    
    result
}

async fn perform_update_check<R: Runtime>(app: AppHandle<R>) -> Result<UpdateStatus, String> {
    match tauri::updater::builder(app.clone()).check().await {
        Ok(update) => {
            if update.is_update_available() {
                // Emit update available event
                app.emit_all("update-available", UpdateStatus {
                    available: true,
                    version: Some(update.latest_version().to_string()),
                    notes: update.body().map(|s| s.to_string()),
                    pub_date: update.date().map(|d| d.to_string()),
                    error: None,
                }).ok();

                Ok(UpdateStatus {
                    available: true,
                    version: Some(update.latest_version().to_string()),
                    notes: update.body().map(|s| s.to_string()),
                    pub_date: update.date().map(|d| d.to_string()),
                    error: None,
                })
            } else {
                Ok(UpdateStatus {
                    available: false,
                    version: None,
                    notes: None,
                    pub_date: None,
                    error: None,
                })
            }
        }
        Err(e) => {
            let error_msg = format!("Failed to check for updates: {}", e);
            Err(error_msg)
        }
    }
}

/// Download and install update
#[tauri::command]
pub async fn download_and_install_update<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, UpdaterState>,
) -> Result<(), String> {
    // Prevent concurrent downloads
    let mut downloading = state.downloading.lock().await;
    if *downloading {
        return Err("Update download already in progress".to_string());
    }
    *downloading = true;
    drop(downloading);

    let app_clone = app.clone();
    
    // Spawn download task
    tokio::spawn(async move {
        match perform_update_download(app_clone.clone()).await {
            Ok(_) => {
                app_clone.emit_all("update-downloaded", ()).ok();
            }
            Err(e) => {
                app_clone.emit_all("update-error", e.clone()).ok();
            }
        }
        
        // Reset downloading flag
        if let Some(state) = app_clone.try_state::<UpdaterState>() {
            let mut downloading = state.downloading.lock().await;
            *downloading = false;
        }
    });
    
    Ok(())
}

async fn perform_update_download<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    match tauri::updater::builder(app.clone()).check().await {
        Ok(update) => {
            if !update.is_update_available() {
                return Err("No update available".to_string());
            }
            // Note: Progress tracking is not available in current Tauri version
            // The download_and_install method doesn't accept a progress callback
            update
                .download_and_install()
                .await
                .map_err(|e| format!("Failed to download update: {}", e))?;
            
            Ok(())
        }
        Err(e) => Err(format!("Failed to check for update: {}", e)),
    }
}

/// Get current app version
#[tauri::command]
pub fn get_current_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Set up auto-update checking
pub fn setup_auto_update_check<R: Runtime>(app: &AppHandle<R>) {
    let app_clone = app.clone();
    
    // Check for updates on startup (after 30 seconds)
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
        
        if let Some(state) = app_clone.try_state::<UpdaterState>() {
            if let Ok(status) = check_for_update(app_clone.clone(), state).await {
                if status.available {
                    app_clone.emit_all("update-available", status).ok();
                }
            }
        }
    });
    
    // Check for updates every 4 hours
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(4 * 60 * 60));
        
        loop {
            interval.tick().await;
            
            if let Some(state) = app_clone.try_state::<UpdaterState>() {
                if let Ok(status) = check_for_update(app_clone.clone(), state).await {
                    if status.available {
                        app_clone.emit_all("update-available", status).ok();
                    }
                }
            }
        }
    });
}

// /// Generate updater keys (for development)
// #[tauri::command]
// pub fn generate_updater_keys() -> Result<(String, String), String> {
//     // Note: generate_keys is not available in current Tauri version
//     // Keys should be generated using external tools
//     Err("Key generation not available in this version".to_string())
// }