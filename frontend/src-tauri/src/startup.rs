use std::time::Instant;
use std::sync::Arc;
use tauri::{AppHandle, Manager as TauriManager};
use tokio::sync::mpsc;
use crate::simple_state_store::SimpleStateStore;
use crate::manager::Manager;
use crate::state_manager::StateManager;
use crate::modules::ModuleLoader;

/// Startup performance metrics
#[derive(Debug, Clone, serde::Serialize)]
pub struct StartupMetrics {
    pub total_ms: u64,
    pub state_store_ms: u64,
    pub neovim_check_ms: u64,
    pub tmux_check_ms: u64,
    pub orchestrator_ms: u64,
    pub module_scan_ms: u64,
}

/// Optimized startup sequence with parallel initialization
pub async fn initialize_app(app: &AppHandle) -> Result<StartupMetrics, Box<dyn std::error::Error>> {
    let start = Instant::now();
    let mut metrics = StartupMetrics {
        total_ms: 0,
        state_store_ms: 0,
        neovim_check_ms: 0,
        tmux_check_ms: 0,
        orchestrator_ms: 0,
        module_scan_ms: 0,
    };

    // Create channels for parallel init results
    let (tx, mut rx) = mpsc::channel::<(&str, Result<u64, String>)>(10);

    // 1. Initialize critical components first
    let state_start = Instant::now();
    
    // Get the managed state store from Tauri and initialize SQLx pool
    let state_store = if let Some(managed_store) = app.try_state::<Arc<SimpleStateStore>>() {
        // Use the managed state store
        managed_store.inner().clone()
    } else {
        // Fallback: create a new one if managed state not available
        let db_path = crate::app_dirs::get_project_dirs()?
            .data_dir()
            .ok_or("Failed to get data directory")?
            .join("orchflow.db");
        Arc::new(SimpleStateStore::new_with_file(db_path.to_str().unwrap())?)
    };
    
    // SQLx pool is now automatically initialized during SimpleStateStore construction
    println!("SQLx pool initialization completed in SimpleStateStore::new()");
    
    let state_manager = StateManager::new(state_store.clone());
    
    // State is automatically loaded from SimpleStateStore as needed
    // No explicit load_from_store() method required
    // Create manager using new MuxBackend system
    let mux_backend = crate::mux_backend::create_mux_backend();
    let manager = Arc::new(Manager::new_with_backend(
        app.clone(),
        mux_backend,
        state_store.clone(),
    ));
    
    // Initialize terminal searcher after manager is created
    manager.initialize_terminal_searcher().await;
    
    // Initialize module loader
    let modules_dir = crate::app_dirs::get_project_dirs()?
        .data_subdir("modules")
        .expect("Failed to get modules directory");
    
    let module_loader = Arc::new(tokio::sync::Mutex::new(
        ModuleLoader::new(modules_dir, state_store.clone())
    ));
    
    // Manage all state
    app.manage(state_store.clone());
    app.manage(state_manager.clone());
    app.manage(manager.clone());
    app.manage(module_loader.clone());
    
    metrics.state_store_ms = state_start.elapsed().as_millis() as u64;

    // 2. Spawn parallel initialization tasks
    let tx1 = tx.clone();
    tokio::spawn(async move {
        let start = Instant::now();
        let result = check_neovim_binary().await;
        let elapsed = start.elapsed().as_millis() as u64;
        tx1.send(("neovim", result.map(|_| elapsed))).await.ok();
    });

    let tx2 = tx.clone();
    tokio::spawn(async move {
        let start = Instant::now();
        let result = check_tmux_binary().await;
        let elapsed = start.elapsed().as_millis() as u64;
        tx2.send(("tmux", result.map(|_| elapsed))).await.ok();
    });

    let tx3 = tx.clone();
    let manager_clone = manager.clone();
    tokio::spawn(async move {
        let start = Instant::now();
        // Manager is already initialized above
        let elapsed = start.elapsed().as_millis() as u64;
        tx3.send(("orchestrator", Ok(elapsed))).await.ok();
    });
    
    let tx4 = tx.clone();
    let loader_clone = module_loader.clone();
    tokio::spawn(async move {
        let start = Instant::now();
        let mut loader = loader_clone.lock().await;
        let result = loader.scan_modules().await
            .map_err(|e| e.to_string());
        let elapsed = start.elapsed().as_millis() as u64;
        tx4.send(("modules", result.map(|_| elapsed))).await.ok();
    });

    // Start WebSocket server for AI integration
    let ws_manager = manager.clone();
    tokio::spawn(async move {
        crate::websocket_server::start_websocket_server(ws_manager, 7777).await;
    });
    
    // Load essential plugins (now Send-safe)
    let plugin_registry = crate::plugins::PluginRegistry::new();
    let plugins_to_load = [
        "file-browser", 
        "test-runner", 
        "terminal", 
        "session",
        "lsp",        // Language Server Protocol
        "syntax",     // Syntax highlighting
        "search",     // Project-wide search
    ];
    
    for plugin_id in &plugins_to_load {
        if let Some(plugin) = plugin_registry.create(plugin_id) {
            if let Err(e) = manager.load_plugin(plugin).await {
                eprintln!("Failed to load plugin {}: {}", plugin_id, e);
            } else {
                println!("Loaded plugin: {}", plugin_id);
            }
        }
    }
    
    // Drop original sender so we know when all tasks are done
    drop(tx);

    // 3. Don't create window during startup - let Tauri handle it

    // 4. Collect parallel init results
    while let Some((component, result)) = rx.recv().await {
        match (component, result) {
            ("neovim", Ok(ms)) => metrics.neovim_check_ms = ms,
            ("tmux", Ok(ms)) => metrics.tmux_check_ms = ms,
            ("orchestrator", Ok(ms)) => metrics.orchestrator_ms = ms,
            ("modules", Ok(ms)) => metrics.module_scan_ms = ms,
            (comp, Err(e)) => eprintln!("Warning: {} init failed: {}", comp, e),
            _ => {}
        }
    }

    metrics.total_ms = start.elapsed().as_millis() as u64;
    
    println!("Startup completed in {}ms", metrics.total_ms);
    println!("  State store: {}ms", metrics.state_store_ms);
    println!("  Neovim check: {}ms", metrics.neovim_check_ms);
    println!("  Tmux check: {}ms", metrics.tmux_check_ms);
    println!("  Orchestrator: {}ms", metrics.orchestrator_ms);
    println!("  Module scan: {}ms", metrics.module_scan_ms);

    Ok(metrics)
}

/// Check if Neovim binary exists (lazy - don't start it yet)
async fn check_neovim_binary() -> Result<(), String> {
    tokio::process::Command::new("nvim")
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Neovim not found: {}", e))?;
    Ok(())
}

/// Check if tmux binary exists (lazy - don't start it yet)
async fn check_tmux_binary() -> Result<(), String> {
    tokio::process::Command::new("tmux")
        .arg("-V")
        .output()
        .await
        .map_err(|e| format!("tmux not found: {}", e))?;
    Ok(())
}



/// Preload critical resources in background
pub fn preload_resources(app: &AppHandle) {
    let handle = app.clone();
    
    tokio::spawn(async move {
        // Preload common module manifests
        if let Some(modules_path) = handle.path_resolver().app_data_dir() {
            let modules_dir = modules_path.join("modules");
            if modules_dir.exists() {
                // Scan and cache module manifests
                if let Ok(entries) = std::fs::read_dir(&modules_dir) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            let manifest_path = entry.path().join("manifest.json");
                            if manifest_path.exists() {
                                // Just read to warm up filesystem cache
                                let _ = std::fs::read_to_string(&manifest_path);
                            }
                        }
                    }
                }
            }
        }
    });
}