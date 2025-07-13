use crate::simple_state_store::SimpleStateStore;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub maximized: bool,
    pub fullscreen: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 1200,
            height: 800,
            x: 0,
            y: 0,
            maximized: false,
            fullscreen: false,
        }
    }
}

/// Save window state to database
pub async fn save_window_state(
    window: &WebviewWindow,
    state_store: Arc<SimpleStateStore>,
) -> Result<(), Box<dyn std::error::Error>> {
    let position = window.outer_position()?;
    let size = window.outer_size()?;
    let is_maximized = window.is_maximized()?;
    let is_fullscreen = window.is_fullscreen()?;

    let window_state = WindowState {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
        maximized: is_maximized,
        fullscreen: is_fullscreen,
    };

    let state_json = serde_json::to_string(&window_state)?;
    state_store
        .set_setting("window_state", &state_json)
        .await
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

    Ok(())
}

/// Restore window state from database
pub async fn restore_window_state(
    window: &WebviewWindow,
    state_store: Arc<SimpleStateStore>,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(state_json) = state_store
        .get_setting("window_state")
        .await
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?
    {
        let window_state: WindowState = serde_json::from_str(&state_json)?;

        // Only restore position and size if window is not maximized or fullscreen
        if !window_state.maximized && !window_state.fullscreen {
            window.set_position(PhysicalPosition::new(window_state.x, window_state.y))?;
            window.set_size(PhysicalSize::new(window_state.width, window_state.height))?;
        }

        // Restore maximized state
        if window_state.maximized {
            window.maximize()?;
        }

        // Restore fullscreen state
        if window_state.fullscreen {
            window.set_fullscreen(true)?;
        }
    }

    Ok(())
}

/// Setup window state persistence
pub fn setup_window_state_persistence(app: &AppHandle) {
    let window = app
        .get_webview_window("main")
        .expect("Failed to get main window");
    let state_store = app.state::<Arc<SimpleStateStore>>();

    // Restore window state on startup
    let state_store_clone = state_store.inner().clone();
    let window_clone = window.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = restore_window_state(&window_clone, state_store_clone).await {
            eprintln!("Failed to restore window state: {}", e);
        }
    });

    // Save window state on resize/move
    let state_store_clone = state_store.inner().clone();
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        use tauri::WindowEvent;

        match event {
            WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                let window = window_clone.clone();
                let state_store = state_store_clone.clone();

                // Debounce saves by using a simple delay
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    if let Err(e) = save_window_state(&window, state_store).await {
                        eprintln!("Failed to save window state: {}", e);
                    }
                });
            }
            _ => {}
        }
    });
}
