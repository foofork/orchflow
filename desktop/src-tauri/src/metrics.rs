use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use sysinfo::System;
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
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub file_system: String,
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub disks: Vec<DiskInfo>,
    pub total_space: u64,
    pub total_used: u64,
    pub total_free: u64,
    pub average_usage_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub bytes_received: u64,
    pub bytes_sent: u64,
    pub packets_received: u64,
    pub packets_sent: u64,
    pub speed: Option<u64>, // bits per second
    pub is_up: bool,
    pub interface_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub interfaces: Vec<NetworkInterface>,
    pub total_bytes_received: u64,
    pub total_bytes_sent: u64,
    pub total_packets_received: u64,
    pub total_packets_sent: u64,
    pub download_speed: f64, // bytes per second
    pub upload_speed: f64,   // bytes per second
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetrics {
    pub pid: u32,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
    pub virtual_memory: u64,
    pub status: String,
    pub cmd: Vec<String>,
    pub start_time: u64,
    pub disk_usage: Option<(u64, u64)>, // (read_bytes, written_bytes)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuMetrics {
    pub name: String,
    pub utilization: Option<f32>,
    pub memory_used: Option<u64>,
    pub memory_total: Option<u64>,
    pub temperature: Option<f32>,
    pub power_usage: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryMetrics {
    pub percentage: f32,
    pub is_charging: bool,
    pub time_remaining: Option<u64>, // seconds
    pub health: Option<f32>,
    pub cycle_count: Option<u32>,
    pub power_consumption: Option<f32>, // watts
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalMetrics {
    pub cpu_temperature: Option<f32>,
    pub gpu_temperature: Option<f32>,
    pub system_temperature: Option<f32>,
    pub fan_speeds: Vec<(String, u32)>, // (fan_name, rpm)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub timestamp: u64,
    pub cpu: CPUMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    pub processes: Vec<ProcessMetrics>,
    pub gpu: Vec<GpuMetrics>,
    pub battery: Option<BatteryMetrics>,
    pub thermal: ThermalMetrics,
    pub uptime: u64,
    pub load_average: [f64; 3],
    pub hostname: String,
    pub os_version: String,
    pub kernel_version: String,
}

pub struct MetricsState {
    system: Mutex<System>,
    last_network_stats: Mutex<Option<(Instant, NetworkMetrics)>>,
    cache: Mutex<HashMap<String, (Instant, String)>>, // Simple cache for expensive operations
}

impl MetricsState {
    pub fn new() -> Self {
        let mut system = System::new_all();
        system.refresh_all();

        MetricsState {
            system: Mutex::new(system),
            last_network_stats: Mutex::new(None),
            cache: Mutex::new(HashMap::new()),
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

    // Enhanced disk metrics with multiple drives
    let disk_metrics = get_enhanced_disk_metrics().unwrap_or_else(|e| {
        eprintln!("Failed to get disk metrics: {}", e);
        // Return fallback metrics
        DiskMetrics {
            disks: vec![],
            total_space: 0,
            total_used: 0,
            total_free: 0,
            average_usage_percent: 0.0,
        }
    });

    // Enhanced network metrics with speed calculation
    let network_metrics = get_enhanced_network_metrics(&state.last_network_stats).unwrap_or_else(|e| {
        eprintln!("Failed to get network metrics: {}", e);
        // Return fallback metrics
        NetworkMetrics {
            interfaces: vec![],
            total_bytes_received: 0,
            total_bytes_sent: 0,
            total_packets_received: 0,
            total_packets_sent: 0,
            download_speed: 0.0,
            upload_speed: 0.0,
        }
    });

    // Enhanced process metrics with more information
    let mut processes: Vec<ProcessMetrics> = system
        .processes()
        .iter()
        .map(|(_pid, process)| ProcessMetrics {
            pid: process.pid().as_u32(),
            name: process.name().to_string(),
            cpu: process.cpu_usage(),
            memory: process.memory(),
            virtual_memory: process.virtual_memory(),
            status: format!("{:?}", process.status()),
            cmd: process.cmd().to_vec(),
            start_time: process.start_time(),
            disk_usage: Some((process.disk_usage().read_bytes, process.disk_usage().written_bytes)),
        })
        .collect();

    // Sort by CPU usage and take top 15
    processes.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap());
    processes.truncate(15);

    // System uptime (using static method in sysinfo 0.30)
    let uptime = sysinfo::System::uptime();

    // Load average (using static method in sysinfo 0.30)
    let load_avg = sysinfo::System::load_average();
    let load_average = [load_avg.one, load_avg.five, load_avg.fifteen];

    // GPU metrics
    let gpu_metrics = get_gpu_metrics(&state.cache).unwrap_or_else(|e| {
        eprintln!("Failed to get GPU metrics: {}", e);
        vec![]
    });
    
    // Battery metrics
    let battery_metrics = get_battery_metrics(&state.cache).unwrap_or_else(|e| {
        eprintln!("Failed to get battery metrics: {}", e);
        None
    });
    
    // Thermal metrics
    let thermal_metrics = get_thermal_metrics(&state.cache).unwrap_or_else(|e| {
        eprintln!("Failed to get thermal metrics: {}", e);
        ThermalMetrics {
            cpu_temperature: None,
            gpu_temperature: None,
            system_temperature: None,
            fan_speeds: vec![],
        }
    });
    
    // System information
    let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "Unknown".to_string());
    let os_version = sysinfo::System::long_os_version().unwrap_or_else(|| "Unknown".to_string());
    let kernel_version = sysinfo::System::kernel_version().unwrap_or_else(|| "Unknown".to_string());
    
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
        gpu: gpu_metrics,
        battery: battery_metrics,
        thermal: thermal_metrics,
        uptime,
        load_average,
        hostname,
        os_version,
        kernel_version,
    })
}

// WebSocket handler for streaming metrics
pub async fn stream_metrics(
    state: State<'_, MetricsState>,
    tx: tokio::sync::mpsc::UnboundedSender<String>,
) {
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

        for line in content.lines().skip(2) {
            // Skip header lines
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

        Ok((
            total_rx_bytes,
            total_tx_bytes,
            total_rx_packets,
            total_tx_packets,
        ))
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // Use netstat on macOS
        let output = Command::new("netstat").arg("-ibn").output()?;

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

        Ok((
            total_rx_bytes,
            total_tx_bytes,
            total_rx_packets,
            total_tx_packets,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        // Use wmic on Windows to get network statistics
        let output = Command::new("wmic")
            .args(&[
                "path",
                "Win32_PerfRawData_Tcpip_NetworkInterface",
                "get",
                "BytesReceivedPerSec,BytesSentPerSec,PacketsReceivedPerSec,PacketsSentPerSec",
                "/format:csv",
            ])
            .output()?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        let mut total_rx_bytes = 0u64;
        let mut total_tx_bytes = 0u64;
        let mut total_rx_packets = 0u64;
        let mut total_tx_packets = 0u64;

        for line in output_str.lines().skip(2) {
            // Skip headers
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 5 {
                total_rx_bytes += parts[1].parse::<u64>().unwrap_or(0);
                total_rx_packets += parts[3].parse::<u64>().unwrap_or(0);
                total_tx_bytes += parts[2].parse::<u64>().unwrap_or(0);
                total_tx_packets += parts[4].parse::<u64>().unwrap_or(0);
            }
        }

        Ok((
            total_rx_bytes,
            total_tx_bytes,
            total_rx_packets,
            total_tx_packets,
        ))
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        // Fallback for other platforms
        Ok((0, 0, 0, 0))
    }
}

/// Get enhanced disk metrics with multiple drives
fn get_enhanced_disk_metrics() -> Result<DiskMetrics, Box<dyn std::error::Error>> {
    let mut disks = Vec::new();
    let mut total_space = 0u64;
    let mut total_used = 0u64;
    let mut total_free = 0u64;

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Get all mounted filesystems
        if let Ok(output) = Command::new("df")
            .arg("-k") // Output in kilobytes
            .arg("-H") // Human readable (don't follow symlinks)
            .output() 
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(1) { // Skip header
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 6 {
                    let device = parts[0];
                    let mount_point = parts[5];
                    
                    // Skip special filesystems
                    if device.starts_with("/dev/") && !mount_point.starts_with("/Volumes/com.apple") {
                        let total = parts[1].parse::<u64>().unwrap_or(0) * 1024;
                        let used = parts[2].parse::<u64>().unwrap_or(0) * 1024;
                        let free = parts[3].parse::<u64>().unwrap_or(0) * 1024;
                        let percent = if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 };
                        
                        disks.push(DiskInfo {
                            name: device.to_string(),
                            mount_point: mount_point.to_string(),
                            file_system: "apfs".to_string(), // Default for macOS
                            total,
                            used,
                            free,
                            percent,
                        });
                        
                        total_space += total;
                        total_used += used;
                        total_free += free;
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Get filesystem information
        if let Ok(output) = Command::new("df")
            .arg("-B1") // Output in bytes
            .arg("-T")  // Show filesystem type
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(1) { // Skip header
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 7 {
                    let device = parts[0];
                    let fs_type = parts[1];
                    let mount_point = parts[6];
                    
                    // Skip special filesystems
                    if device.starts_with("/dev/") && !["tmpfs", "devtmpfs", "sysfs", "proc"].contains(&fs_type) {
                        let total = parts[2].parse::<u64>().unwrap_or(0);
                        let used = parts[3].parse::<u64>().unwrap_or(0);
                        let free = parts[4].parse::<u64>().unwrap_or(0);
                        let percent = if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 };
                        
                        disks.push(DiskInfo {
                            name: device.to_string(),
                            mount_point: mount_point.to_string(),
                            file_system: fs_type.to_string(),
                            total,
                            used,
                            free,
                            percent,
                        });
                        
                        total_space += total;
                        total_used += used;
                        total_free += free;
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Get disk information using wmic
        if let Ok(output) = Command::new("wmic")
            .args(&[
                "logicaldisk",
                "get",
                "DeviceID,FileSystem,Size,FreeSpace",
                "/format:csv"
            ])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(2) { // Skip headers
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 5 && !parts[1].trim().is_empty() {
                    let device = parts[1].trim();
                    let fs_type = parts[2].trim();
                    let free = parts[3].trim().parse::<u64>().unwrap_or(0);
                    let total = parts[4].trim().parse::<u64>().unwrap_or(0);
                    let used = if total > free { total - free } else { 0 };
                    let percent = if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 };
                    
                    disks.push(DiskInfo {
                        name: device.to_string(),
                        mount_point: device.to_string(),
                        file_system: fs_type.to_string(),
                        total,
                        used,
                        free,
                        percent,
                    });
                    
                    total_space += total;
                    total_used += used;
                    total_free += free;
                }
            }
        }
    }

    let average_usage_percent = if total_space > 0 {
        (total_used as f32 / total_space as f32) * 100.0
    } else {
        0.0
    };

    Ok(DiskMetrics {
        disks,
        total_space,
        total_used,
        total_free,
        average_usage_percent,
    })
}

/// Get enhanced network metrics with speed calculation
fn get_enhanced_network_metrics(last_stats: &Mutex<Option<(Instant, NetworkMetrics)>>) -> Result<NetworkMetrics, Box<dyn std::error::Error>> {
    let mut interfaces = Vec::new();
    let mut total_rx_bytes = 0u64;
    let mut total_tx_bytes = 0u64;
    let mut total_rx_packets = 0u64;
    let mut total_tx_packets = 0u64;
    
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        
        // Read network interface information
        if let Ok(content) = fs::read_to_string("/proc/net/dev") {
            for line in content.lines().skip(2) { // Skip header lines
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 17 {
                    let interface_name = parts[0].trim_end_matches(':');
                    
                    // Skip loopback interface
                    if interface_name != "lo" {
                        let rx_bytes = parts[1].parse::<u64>().unwrap_or(0);
                        let rx_packets = parts[2].parse::<u64>().unwrap_or(0);
                        let tx_bytes = parts[9].parse::<u64>().unwrap_or(0);
                        let tx_packets = parts[10].parse::<u64>().unwrap_or(0);
                        
                        // Check if interface is up
                        let is_up = check_interface_status_linux(interface_name);
                        let interface_type = get_interface_type_linux(interface_name);
                        
                        interfaces.push(NetworkInterface {
                            name: interface_name.to_string(),
                            bytes_received: rx_bytes,
                            bytes_sent: tx_bytes,
                            packets_received: rx_packets,
                            packets_sent: tx_packets,
                            speed: get_interface_speed_linux(interface_name),
                            is_up,
                            interface_type,
                        });
                        
                        total_rx_bytes += rx_bytes;
                        total_tx_bytes += tx_bytes;
                        total_rx_packets += rx_packets;
                        total_tx_packets += tx_packets;
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        if let Ok(output) = Command::new("netstat").arg("-ibn").output() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(1) { // Skip header
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 11 && !parts[0].starts_with("lo") && parts[2].contains("Link") {
                    let interface_name = parts[0];
                    let rx_packets = parts[4].parse::<u64>().unwrap_or(0);
                    let rx_bytes = parts[6].parse::<u64>().unwrap_or(0);
                    let tx_packets = parts[7].parse::<u64>().unwrap_or(0);
                    let tx_bytes = parts[9].parse::<u64>().unwrap_or(0);
                    
                    interfaces.push(NetworkInterface {
                        name: interface_name.to_string(),
                        bytes_received: rx_bytes,
                        bytes_sent: tx_bytes,
                        packets_received: rx_packets,
                        packets_sent: tx_packets,
                        speed: None, // Not easily available on macOS
                        is_up: true, // Assume up if listed
                        interface_type: get_interface_type_macos(interface_name),
                    });
                    
                    total_rx_bytes += rx_bytes;
                    total_tx_bytes += tx_bytes;
                    total_rx_packets += rx_packets;
                    total_tx_packets += tx_packets;
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Use PowerShell to get network adapter statistics
        if let Ok(output) = Command::new("powershell")
            .arg("-Command")
            .arg("Get-NetAdapterStatistics | ConvertTo-Json")
            .output()
        {
            if let Ok(json_str) = String::from_utf8(output.stdout) {
                // Parse JSON response (simplified - would need serde_json for full parsing)
                // For now, use a simpler approach with wmic
            }
        }
        
        // Fallback to wmic
        if let Ok(output) = Command::new("wmic")
            .args(&[
                "path",
                "Win32_PerfRawData_Tcpip_NetworkInterface",
                "get",
                "Name,BytesReceivedPerSec,BytesSentPerSec,PacketsReceivedPerSec,PacketsSentPerSec",
                "/format:csv"
            ])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(2) { // Skip headers
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 6 && !parts[4].trim().is_empty() {
                    let interface_name = parts[4].trim();
                    
                    // Skip loopback and tunnel interfaces
                    if !interface_name.contains("Loopback") && !interface_name.contains("Tunnel") {
                        let rx_bytes = parts[1].parse::<u64>().unwrap_or(0);
                        let tx_bytes = parts[2].parse::<u64>().unwrap_or(0);
                        let rx_packets = parts[3].parse::<u64>().unwrap_or(0);
                        let tx_packets = parts[5].parse::<u64>().unwrap_or(0);
                        
                        interfaces.push(NetworkInterface {
                            name: interface_name.to_string(),
                            bytes_received: rx_bytes,
                            bytes_sent: tx_bytes,
                            packets_received: rx_packets,
                            packets_sent: tx_packets,
                            speed: None,
                            is_up: true,
                            interface_type: "ethernet".to_string(),
                        });
                        
                        total_rx_bytes += rx_bytes;
                        total_tx_bytes += tx_bytes;
                        total_rx_packets += rx_packets;
                        total_tx_packets += tx_packets;
                    }
                }
            }
        }
    }

    // Calculate download/upload speeds
    let (download_speed, upload_speed) = if let Ok(last_stats_guard) = last_stats.lock() {
        if let Some((last_time, ref last_metrics)) = *last_stats_guard {
            let now = Instant::now();
            let time_diff = now.duration_since(last_time).as_secs_f64();
            
            if time_diff > 0.0 {
                let download_speed = (total_rx_bytes.saturating_sub(last_metrics.total_bytes_received) as f64) / time_diff;
                let upload_speed = (total_tx_bytes.saturating_sub(last_metrics.total_bytes_sent) as f64) / time_diff;
                (download_speed, upload_speed)
            } else {
                (0.0, 0.0)
            }
        } else {
            (0.0, 0.0)
        }
    } else {
        (0.0, 0.0)
    };

    let current_metrics = NetworkMetrics {
        interfaces,
        total_bytes_received: total_rx_bytes,
        total_bytes_sent: total_tx_bytes,
        total_packets_received: total_rx_packets,
        total_packets_sent: total_tx_packets,
        download_speed,
        upload_speed,
    };

    // Update last stats
    if let Ok(mut last_stats_guard) = last_stats.lock() {
        *last_stats_guard = Some((Instant::now(), current_metrics.clone()));
    }

    Ok(current_metrics)
}

/// Get GPU metrics (platform-specific implementations)
fn get_gpu_metrics(cache: &Mutex<HashMap<String, (Instant, String)>>) -> Result<Vec<GpuMetrics>, Box<dyn std::error::Error>> {
    // Check cache first (GPU metrics can be expensive)
    let cache_key = "gpu_metrics";
    let cache_duration = Duration::from_secs(5); // Cache for 5 seconds
    
    if let Ok(cache_guard) = cache.lock() {
        if let Some((last_time, cached_data)) = cache_guard.get(cache_key) {
            if last_time.elapsed() < cache_duration {
                if let Ok(cached_metrics) = serde_json::from_str::<Vec<GpuMetrics>>(cached_data) {
                    return Ok(cached_metrics);
                }
            }
        }
    }
    let mut gpus = Vec::new();

    #[cfg(target_os = "linux")]
    {
        // Try NVIDIA first
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .args(&["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw", "--format=csv,noheader,nounits"])
            .output()
        {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for line in output_str.lines() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 6 {
                        gpus.push(GpuMetrics {
                            name: parts[0].to_string(),
                            utilization: parts[1].parse().ok(),
                            memory_used: parts[2].parse::<u64>().ok().map(|v| v * 1024 * 1024), // MB to bytes
                            memory_total: parts[3].parse::<u64>().ok().map(|v| v * 1024 * 1024),
                            temperature: parts[4].parse().ok(),
                            power_usage: parts[5].parse().ok(),
                        });
                    }
                }
            }
        }
        
        // Try AMD (incomplete, would need more specific tools)
        // Could use radeontop or other AMD-specific utilities
    }

    #[cfg(target_os = "macos")]
    {
        // macOS GPU monitoring is limited without additional tools
        // Could use ioreg or system_profiler for basic info
        if let Ok(output) = std::process::Command::new("system_profiler")
            .arg("SPDisplaysDataType")
            .arg("-json")
            .output()
        {
            // Would need to parse JSON output for GPU information
            // Simplified implementation
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows GPU monitoring using WMI
        if let Ok(output) = std::process::Command::new("wmic")
            .args(&["path", "win32_VideoController", "get", "Name,AdapterRAM", "/format:csv"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(2) {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 3 && !parts[2].trim().is_empty() {
                    gpus.push(GpuMetrics {
                        name: parts[2].trim().to_string(),
                        utilization: None,
                        memory_used: None,
                        memory_total: parts[1].parse().ok(),
                        temperature: None,
                        power_usage: None,
                    });
                }
            }
        }
    }

    // Update cache
    if let Ok(serialized) = serde_json::to_string(&gpus) {
        if let Ok(mut cache_guard) = cache.lock() {
            cache_guard.insert(cache_key.to_string(), (Instant::now(), serialized));
        }
    }

    Ok(gpus)
}

/// Get battery metrics
fn get_battery_metrics(cache: &Mutex<HashMap<String, (Instant, String)>>) -> Result<Option<BatteryMetrics>, Box<dyn std::error::Error>> {
    // Check cache first
    let cache_key = "battery_metrics";
    let cache_duration = Duration::from_secs(10); // Cache for 10 seconds
    
    if let Ok(cache_guard) = cache.lock() {
        if let Some((last_time, cached_data)) = cache_guard.get(cache_key) {
            if last_time.elapsed() < cache_duration {
                if let Ok(cached_metrics) = serde_json::from_str::<Option<BatteryMetrics>>(cached_data) {
                    return Ok(cached_metrics);
                }
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("pmset")
            .arg("-g")
            .arg("batt")
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                if line.contains("InternalBattery") {
                    // Parse battery information from pmset output
                    // Example: "InternalBattery-0 (id=1234567)  85%; discharging; 5:30 remaining present: true"
                    if let Some(percentage_str) = line.split_whitespace().find(|s| s.ends_with("%;")) {
                        if let Ok(percentage) = percentage_str.trim_end_matches("%;").parse::<f32>() {
                            let is_charging = line.contains("charging") && !line.contains("discharging");
                            let time_remaining = if line.contains("remaining") {
                                // Parse time remaining (simplified)
                                None
                            } else {
                                None
                            };
                            
                            let battery_metrics = Some(BatteryMetrics {
                                percentage,
                                is_charging,
                                time_remaining,
                                health: None,
                                cycle_count: None,
                                power_consumption: None,
                            });
                            
                            // Update cache
                            if let Ok(serialized) = serde_json::to_string(&battery_metrics) {
                                if let Ok(mut cache_guard) = cache.lock() {
                                    cache_guard.insert(cache_key.to_string(), (Instant::now(), serialized));
                                }
                            }
                            
                            return Ok(battery_metrics);
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Check /sys/class/power_supply for battery information
        if let Ok(entries) = std::fs::read_dir("/sys/class/power_supply") {
            for entry in entries.flatten() {
                if entry.file_name().to_string_lossy().starts_with("BAT") {
                    let battery_path = entry.path();
                    
                    let capacity = std::fs::read_to_string(battery_path.join("capacity"))
                        .ok()
                        .and_then(|s| s.trim().parse::<f32>().ok())
                        .unwrap_or(0.0);
                    
                    let status = std::fs::read_to_string(battery_path.join("status"))
                        .unwrap_or_default()
                        .trim()
                        .to_lowercase();
                    
                    let is_charging = status.contains("charging");
                    
                    let battery_metrics = Some(BatteryMetrics {
                        percentage: capacity,
                        is_charging,
                        time_remaining: None,
                        health: None,
                        cycle_count: None,
                        power_consumption: None,
                    });
                    
                    // Update cache
                    if let Ok(serialized) = serde_json::to_string(&battery_metrics) {
                        if let Ok(mut cache_guard) = cache.lock() {
                            cache_guard.insert(cache_key.to_string(), (Instant::now(), serialized));
                        }
                    }
                    
                    return Ok(battery_metrics);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("wmic")
            .args(&["path", "Win32_Battery", "get", "EstimatedChargeRemaining", "/format:csv"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(2) {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 && !parts[1].trim().is_empty() {
                    if let Ok(percentage) = parts[1].trim().parse::<f32>() {
                        return Some(BatteryMetrics {
                            percentage,
                            is_charging: false, // Would need additional check
                            time_remaining: None,
                            health: None,
                            cycle_count: None,
                            power_consumption: None,
                        });
                    }
                }
            }
        }
    }

    // Update cache with None result
    if let Ok(mut cache_guard) = cache.lock() {
        cache_guard.insert(cache_key.to_string(), (Instant::now(), "null".to_string()));
    }
    
    Ok(None)
}

/// Get thermal metrics
fn get_thermal_metrics(cache: &Mutex<HashMap<String, (Instant, String)>>) -> Result<ThermalMetrics, Box<dyn std::error::Error>> {
    // Check cache first
    let cache_key = "thermal_metrics";
    let cache_duration = Duration::from_secs(3); // Cache for 3 seconds
    
    if let Ok(cache_guard) = cache.lock() {
        if let Some((last_time, cached_data)) = cache_guard.get(cache_key) {
            if last_time.elapsed() < cache_duration {
                if let Ok(cached_metrics) = serde_json::from_str::<ThermalMetrics>(cached_data) {
                    return Ok(cached_metrics);
                }
            }
        }
    }
    let mut cpu_temperature = None;
    let gpu_temperature = None;
    let system_temperature = None;
    let mut fan_speeds = Vec::new();

    #[cfg(target_os = "linux")]
    {
        // Read temperature sensors
        if let Ok(entries) = std::fs::read_dir("/sys/class/thermal") {
            for entry in entries.flatten() {
                if entry.file_name().to_string_lossy().starts_with("thermal_zone") {
                    let zone_path = entry.path();
                    if let Ok(temp_str) = std::fs::read_to_string(zone_path.join("temp")) {
                        if let Ok(temp_millidegrees) = temp_str.trim().parse::<i32>() {
                            let temp_celsius = temp_millidegrees as f32 / 1000.0;
                            if cpu_temperature.is_none() {
                                cpu_temperature = Some(temp_celsius);
                            }
                        }
                    }
                }
            }
        }
        
        // Read fan speeds from hwmon
        if let Ok(entries) = std::fs::read_dir("/sys/class/hwmon") {
            for entry in entries.flatten() {
                let hwmon_path = entry.path();
                if let Ok(fan_entries) = std::fs::read_dir(&hwmon_path) {
                    for fan_entry in fan_entries.flatten() {
                        let fan_name = fan_entry.file_name().to_string_lossy().to_string();
                        if fan_name.starts_with("fan") && fan_name.ends_with("_input") {
                            if let Ok(rpm_str) = std::fs::read_to_string(fan_entry.path()) {
                                if let Ok(rpm) = rpm_str.trim().parse::<u32>() {
                                    fan_speeds.push((fan_name, rpm));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS temperature monitoring is limited without additional tools
        // Could use third-party tools like TG Pro or iStat Menus
        // For now, try to get CPU temperature from available sources
        if let Ok(output) = std::process::Command::new("sysctl")
            .arg("machdep.xcpm.cpu_thermal_state")
            .output()
        {
            // Parse thermal state information if available
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows temperature monitoring using WMI
        if let Ok(output) = std::process::Command::new("wmic")
            .args(&["/namespace:\\\\root\\wmi", "path", "MSAcpi_ThermalZoneTemperature", "get", "CurrentTemperature", "/format:csv"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(2) {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 && !parts[1].trim().is_empty() {
                    if let Ok(temp_kelvin) = parts[1].trim().parse::<f32>() {
                        let temp_celsius = (temp_kelvin / 10.0) - 273.15;
                        cpu_temperature = Some(temp_celsius);
                        break;
                    }
                }
            }
        }
    }

    let thermal_metrics = ThermalMetrics {
        cpu_temperature,
        gpu_temperature,
        system_temperature,
        fan_speeds,
    };
    
    // Update cache
    if let Ok(serialized) = serde_json::to_string(&thermal_metrics) {
        if let Ok(mut cache_guard) = cache.lock() {
            cache_guard.insert(cache_key.to_string(), (Instant::now(), serialized));
        }
    }
    
    Ok(thermal_metrics)
}

// Helper functions for Linux network interface information
#[cfg(target_os = "linux")]
fn check_interface_status_linux(interface: &str) -> bool {
    std::fs::read_to_string(format!("/sys/class/net/{}/operstate", interface))
        .map(|s| s.trim() == "up")
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn get_interface_type_linux(interface: &str) -> String {
    std::fs::read_to_string(format!("/sys/class/net/{}/type", interface))
        .ok()
        .and_then(|s| s.trim().parse::<u16>().ok())
        .map(|type_id| match type_id {
            1 => "ethernet".to_string(),
            24 => "ethernet".to_string(), // IEEE 802.5
            772 => "loopback".to_string(),
            801 => "wireless".to_string(),
            _ => "unknown".to_string(),
        })
        .unwrap_or_else(|| "unknown".to_string())
}

#[cfg(target_os = "linux")]
fn get_interface_speed_linux(interface: &str) -> Option<u64> {
    std::fs::read_to_string(format!("/sys/class/net/{}/speed", interface))
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map(|speed_mbps| speed_mbps * 1_000_000) // Convert Mbps to bps
}

#[cfg(target_os = "macos")]
fn get_interface_type_macos(interface: &str) -> String {
    if interface.starts_with("en") {
        "ethernet".to_string()
    } else if interface.starts_with("lo") {
        "loopback".to_string()
    } else {
        "unknown".to_string()
    }
}
