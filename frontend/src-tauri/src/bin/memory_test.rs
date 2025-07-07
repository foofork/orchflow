use std::sync::Arc;
use orchflow::simple_state_store::SimpleStateStore;
use orchflow::mux_backend;
use sysinfo::{System, Pid};
use std::process;

#[tokio::main]
async fn main() {
    println!("Testing memory usage...\n");
    
    // Get initial memory baseline
    let mut system = System::new_all();
    system.refresh_all();
    let pid = Pid::from_u32(process::id());
    
    let baseline_memory = if let Some(process) = system.processes().get(&pid) {
        process.memory() / 1024 // Convert to KB
    } else {
        0
    };
    
    println!("Baseline memory: {} KB", baseline_memory);
    
    // Initialize core components
    println!("\nInitializing components:");
    
    // 1. State Store
    let _state_store = Arc::new(SimpleStateStore::new().unwrap());
    system.refresh_processes();
    let after_store = system.processes().get(&pid).map(|p| p.memory() / 1024).unwrap_or(0);
    println!("After StateStore: {} KB (+{} KB)", after_store, after_store - baseline_memory);
    
    // 2. Mux Backend
    let _mux_backend = mux_backend::create_mux_backend();
    system.refresh_processes();
    let after_mux = system.processes().get(&pid).map(|p| p.memory() / 1024).unwrap_or(0);
    println!("After MuxBackend: {} KB (+{} KB)", after_mux, after_mux - after_store);
    
    // 3. Manager (without AppHandle, simplified)
    // Note: Can't create full Manager without Tauri AppHandle, but we can measure the backend
    system.refresh_processes();
    let after_manager = system.processes().get(&pid).map(|p| p.memory() / 1024).unwrap_or(0);
    println!("After Manager setup: {} KB (+{} KB)", after_manager, after_manager - after_mux);
    
    // 4. Plugin Registry
    let _plugin_registry = orchflow::plugins::PluginRegistry::new();
    system.refresh_processes();
    let after_plugins = system.processes().get(&pid).map(|p| p.memory() / 1024).unwrap_or(0);
    println!("After PluginRegistry: {} KB (+{} KB)", after_plugins, after_plugins - after_manager);
    
    // Summary
    println!("\n=== Memory Usage Summary ===");
    println!("Total memory used: {} KB ({:.1} MB)", after_plugins, after_plugins as f64 / 1024.0);
    println!("Target: <100 MB");
    
    if after_plugins < 100 * 1024 {
        println!("✅ Memory usage is within target!");
    } else {
        println!("❌ Memory usage exceeds target by {:.1} MB", (after_plugins as f64 / 1024.0) - 100.0);
    }
    
    // Breakdown
    println!("\n=== Component Breakdown ===");
    println!("StateStore: {} KB", after_store - baseline_memory);
    println!("MuxBackend: {} KB", after_mux - after_store);
    println!("Manager: {} KB", after_manager - after_mux);
    println!("PluginRegistry: {} KB", after_plugins - after_manager);
}