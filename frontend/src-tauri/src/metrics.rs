use serde::{Deserialize, Serialize};
use sysinfo::System;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CPUMetrics {
    pub usage: f32,
    pub frequency: u64,
    pub temperature: Option<f32>,
    pub cores: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub available: u64,
    pub percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub bytes_received: u64,
    pub bytes_sent: u64,
    pub packets_received: u64,
    pub packets_sent: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetrics {
    pub pid: u32,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub timestamp: u64,
    pub cpu: CPUMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    pub processes: Vec<ProcessMetrics>,
    pub uptime: u64,
    pub load_average: [f64; 3],
}

pub struct MetricsState {
    system: Mutex<System>,
}

impl MetricsState {
    pub fn new() -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        
        MetricsState {
            system: Mutex::new(system),
        }
    }
}

#[tauri::command]
pub fn get_system_metrics(state: State<MetricsState>) -> Result<SystemMetrics, String> {
    let mut system = state.system.lock().map_err(|e| e.to_string())?;
    
    // Refresh system information
    system.refresh_all();
    system.refresh_cpu();
    system.refresh_memory();
    system.refresh_processes();
    
    // Note: disk and network APIs were removed in sysinfo 0.30
    // Using alternative methods or placeholders
    
    // CPU metrics
    let cpu_usage = system.global_cpu_info().cpu_usage();
    let cpu_frequency = system.global_cpu_info().frequency();
    let cpu_count = system.cpus().len();
    
    let cpu_metrics = CPUMetrics {
        usage: cpu_usage,
        frequency: cpu_frequency,
        temperature: None, // Temperature not always available
        cores: cpu_count,
    };
    
    // Memory metrics
    let total_memory = system.total_memory();
    let used_memory = system.used_memory();
    let free_memory = system.free_memory();
    let available_memory = system.available_memory();
    let memory_percent = (used_memory as f32 / total_memory as f32) * 100.0;
    
    let memory_metrics = MemoryMetrics {
        total: total_memory,
        used: used_memory,
        free: free_memory,
        available: available_memory,
        percent: memory_percent,
    };
    
    // Disk metrics - using std::fs for basic disk space info
    let disk_metrics = match get_disk_usage() {
        Ok((total, used, free)) => DiskMetrics {
            total,
            used,
            free,
            percent: if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 },
        },
        Err(_) => DiskMetrics {
            total: 0,
            used: 0,
            free: 0,
            percent: 0.0,
        },
    };
    
    // Network metrics - using alternative approach for sysinfo 0.30
    let network_metrics = match get_network_stats() {
        Ok((rx, tx, rx_packets, tx_packets)) => NetworkMetrics {
            bytes_received: rx,
            bytes_sent: tx,
            packets_received: rx_packets,
            packets_sent: tx_packets,
        },
        Err(_) => NetworkMetrics {
            bytes_received: 0,
            bytes_sent: 0,
            packets_received: 0,
            packets_sent: 0,
        },
    };
    
    // Process metrics (top 10 by CPU usage)
    let mut processes: Vec<ProcessMetrics> = system.processes()
        .iter()
        .map(|(_pid, process)| ProcessMetrics {
            pid: process.pid().as_u32(),
            name: process.name().to_string(),
            cpu: process.cpu_usage(),
            memory: process.memory(),
            status: format!("{:?}", process.status()),
        })
        .collect();
    
    // Sort by CPU usage and take top 10
    processes.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap());
    processes.truncate(10);
    
    // System uptime (using static method in sysinfo 0.30)
    let uptime = sysinfo::System::uptime();
    
    // Load average (using static method in sysinfo 0.30)
    let load_avg = sysinfo::System::load_average();
    let load_average = [load_avg.one, load_avg.five, load_avg.fifteen];
    
    // Current timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    
    Ok(SystemMetrics {
        timestamp,
        cpu: cpu_metrics,
        memory: memory_metrics,
        disk: disk_metrics,
        network: network_metrics,
        processes,
        uptime,
        load_average,
    })
}

// WebSocket handler for streaming metrics
pub async fn stream_metrics(state: State<'_, MetricsState>, mut tx: tokio::sync::mpsc::UnboundedSender<String>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));
    
    loop {
        interval.tick().await;
        
        match get_system_metrics(state.clone()) {
            Ok(metrics) => {
                if let Ok(json) = serde_json::to_string(&metrics) {
                    if tx.send(json).is_err() {
                        // Client disconnected
                        break;
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to get metrics: {}", e);
            }
        }
    }
}

/// Get disk usage using platform-specific approach
fn get_disk_usage() -> Result<(u64, u64, u64), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Use df command on macOS
        let output = Command::new("df")
            .arg("-k") // Output in kilobytes
            .arg("/")   // Root filesystem
            .output()?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = output_str.lines().collect();
        
        if lines.len() >= 2 {
            let parts: Vec<&str> = lines[1].split_whitespace().collect();
            if parts.len() >= 4 {
                let total = parts[1].parse::<u64>().unwrap_or(0) * 1024; // Convert KB to bytes
                let used = parts[2].parse::<u64>().unwrap_or(0) * 1024;
                let available = parts[3].parse::<u64>().unwrap_or(0) * 1024;
                return Ok((total, used, available));
            }
        }
        
        // Fallback values
        Ok((1_000_000_000_000, 500_000_000_000, 500_000_000_000))
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        
        // Use statvfs on Linux
        let path = std::path::Path::new("/");
        if let Ok(metadata) = fs::metadata(path) {
            // Try to read from /proc/mounts or use df command
            use std::process::Command;
            
            let output = Command::new("df")
                .arg("-B1") // Output in bytes
                .arg("/")
                .output()?;
            
            let output_str = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<&str> = output_str.lines().collect();
            
            if lines.len() >= 2 {
                let parts: Vec<&str> = lines[1].split_whitespace().collect();
                if parts.len() >= 4 {
                    let total = parts[1].parse::<u64>().unwrap_or(0);
                    let used = parts[2].parse::<u64>().unwrap_or(0);
                    let available = parts[3].parse::<u64>().unwrap_or(0);
                    return Ok((total, used, available));
                }
            }
        }
        
        // Fallback values
        Ok((1_000_000_000_000, 500_000_000_000, 500_000_000_000))
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Use wmic command on Windows
        let output = Command::new("wmic")
            .args(&["logicaldisk", "where", "name='C:'", "get", "size,freespace", "/format:value"])
            .output()?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let mut total = 0u64;
        let mut free = 0u64;
        
        for line in output_str.lines() {
            if let Some(size_str) = line.strip_prefix("Size=") {
                total = size_str.trim().parse().unwrap_or(0);
            } else if let Some(free_str) = line.strip_prefix("FreeSpace=") {
                free = free_str.trim().parse().unwrap_or(0);
            }
        }
        
        let used = if total > free { total - free } else { 0 };
        Ok((total, used, free))
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        // Fallback for other platforms
        Ok((1_000_000_000_000, 500_000_000_000, 500_000_000_000))
    }
}

/// Get network statistics using platform-specific approach
fn get_network_stats() -> Result<(u64, u64, u64, u64), Box<dyn std::error::Error>> {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        
        // Read from /proc/net/dev on Linux
        let content = fs::read_to_string("/proc/net/dev")?;
        let mut total_rx_bytes = 0u64;
        let mut total_tx_bytes = 0u64;
        let mut total_rx_packets = 0u64;
        let mut total_tx_packets = 0u64;
        
        for line in content.lines().skip(2) { // Skip header lines
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 9 {
                // Skip loopback interface
                if !parts[0].starts_with("lo:") {
                    total_rx_bytes += parts[1].parse::<u64>().unwrap_or(0);
                    total_rx_packets += parts[2].parse::<u64>().unwrap_or(0);
                    total_tx_bytes += parts[9].parse::<u64>().unwrap_or(0);
                    total_tx_packets += parts[10].parse::<u64>().unwrap_or(0);
                }
            }
        }
        
        Ok((total_rx_bytes, total_tx_bytes, total_rx_packets, total_tx_packets))
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Use netstat on macOS
        let output = Command::new("netstat")
            .arg("-ibn")
            .output()?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let mut total_rx_bytes = 0u64;
        let mut total_tx_bytes = 0u64;
        let mut total_rx_packets = 0u64;
        let mut total_tx_packets = 0u64;
        
        for line in output_str.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Look for network interfaces (not loopback)
            if parts.len() >= 11 && !parts[0].starts_with("lo") && parts[2] == "<Link#" {
                total_rx_packets += parts[4].parse::<u64>().unwrap_or(0);
                total_rx_bytes += parts[6].parse::<u64>().unwrap_or(0);
                total_tx_packets += parts[7].parse::<u64>().unwrap_or(0);
                total_tx_bytes += parts[9].parse::<u64>().unwrap_or(0);
            }
        }
        
        Ok((total_rx_bytes, total_tx_bytes, total_rx_packets, total_tx_packets))
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Use wmic on Windows to get network statistics
        let output = Command::new("wmic")
            .args(&["path", "Win32_PerfRawData_Tcpip_NetworkInterface", "get", "BytesReceivedPerSec,BytesSentPerSec,PacketsReceivedPerSec,PacketsSentPerSec", "/format:csv"])
            .output()?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let mut total_rx_bytes = 0u64;
        let mut total_tx_bytes = 0u64;
        let mut total_rx_packets = 0u64;
        let mut total_tx_packets = 0u64;
        
        for line in output_str.lines().skip(2) { // Skip headers
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 5 {
                total_rx_bytes += parts[1].parse::<u64>().unwrap_or(0);
                total_rx_packets += parts[3].parse::<u64>().unwrap_or(0);
                total_tx_bytes += parts[2].parse::<u64>().unwrap_or(0);
                total_tx_packets += parts[4].parse::<u64>().unwrap_or(0);
            }
        }
        
        Ok((total_rx_bytes, total_tx_bytes, total_rx_packets, total_tx_packets))
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        // Fallback for other platforms
        Ok((0, 0, 0, 0))
    }
}