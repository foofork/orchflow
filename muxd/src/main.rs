mod error;
mod protocol;
mod terminal;
mod session;
mod server;
mod client;
mod daemon;
mod state;

use clap::{Parser, Subcommand};
use error::Result;
use protocol::types::MuxdConfig;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Parser)]
#[command(name = "muxd")]
#[command(about = "Multiplexer Daemon for orchflow", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
    
    /// Port to listen on
    #[arg(short, long, default_value = "7890")]
    port: u16,
    
    /// Log level
    #[arg(short, long, default_value = "info")]
    log_level: String,
    
    /// Data directory for persistence
    #[arg(short, long, default_value = "~/.muxd")]
    data_dir: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the daemon
    Start {
        /// Run in foreground
        #[arg(short, long)]
        foreground: bool,
    },
    /// Stop the daemon
    Stop,
    /// Check daemon status
    Status,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Initialize logging
    let level = match cli.log_level.to_lowercase().as_str() {
        "trace" => Level::TRACE,
        "debug" => Level::DEBUG,
        "info" => Level::INFO,
        "warn" => Level::WARN,
        "error" => Level::ERROR,
        _ => Level::INFO,
    };
    
    let subscriber = FmtSubscriber::builder()
        .with_max_level(level)
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");
    
    // Expand data directory
    let data_dir = shellexpand::tilde(&cli.data_dir).to_string();
    
    // Create config
    let config = MuxdConfig {
        port: cli.port,
        unix_socket: None,
        max_sessions: 100,
        max_panes_per_session: 50,
        output_buffer_size: 64 * 1024,
        auth_enabled: false,
        log_level: cli.log_level,
        data_dir,
    };
    
    match &cli.command {
        Some(Commands::Start { foreground }) => {
            info!("Starting muxd on port {}", config.port);
            
            // Create daemon manager
            let daemon = daemon::Daemon::new(&config.data_dir)?;
            
            // Check if already running
            if daemon.is_running() {
                eprintln!("muxd is already running (PID: {})", daemon.get_pid().unwrap_or(0));
                std::process::exit(1);
            }
            
            if !foreground {
                // Daemonize the process
                daemon.daemonize()?;
                info!("Running as daemon");
            } else {
                // Write PID file even in foreground mode
                daemon.write_pid()?;
                info!("Running in foreground");
            }
            
            // Start the server
            let result = server::start_server(config).await;
            
            // Clean up PID file on exit
            let _ = daemon.remove_pid_file();
            
            result?;
        }
        Some(Commands::Stop) => {
            info!("Stopping muxd");
            
            // Create daemon manager
            let daemon = daemon::Daemon::new(&config.data_dir)?;
            
            // First try to stop via daemon manager (for Unix systems)
            #[cfg(unix)]
            {
                if daemon.is_running() {
                    match daemon.stop() {
                        Ok(()) => {
                            println!("muxd stopped successfully");
                            return Ok(());
                        }
                        Err(e) => {
                            info!("Failed to stop via signal, trying WebSocket: {}", e);
                        }
                    }
                }
            }
            
            // Fall back to WebSocket shutdown
            match client::stop_daemon(cli.port).await {
                Ok(()) => {
                    println!("muxd stopped successfully");
                }
                Err(e) => {
                    eprintln!("Failed to stop muxd: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Some(Commands::Status) => {
            // Create daemon manager
            let daemon = daemon::Daemon::new(&config.data_dir)?;
            
            match client::check_daemon_status(cli.port).await {
                Ok(status) => {
                    if status.get("running").and_then(|v| v.as_bool()).unwrap_or(false) {
                        println!("muxd is running");
                        
                        // Show PID if available
                        if let Some(pid) = daemon.get_pid() {
                            println!("  PID: {}", pid);
                        }
                        
                        if let Some(version) = status.get("version").and_then(|v| v.as_str()) {
                            println!("  Version: {}", version);
                        }
                        if let Some(sessions) = status.get("sessions").and_then(|v| v.as_u64()) {
                            println!("  Sessions: {}", sessions);
                        }
                        if let Some(panes) = status.get("total_panes").and_then(|v| v.as_u64()) {
                            println!("  Total panes: {}", panes);
                        }
                    } else {
                        println!("muxd is not running on port {}", cli.port);
                        std::process::exit(1);
                    }
                }
                Err(e) => {
                    eprintln!("Failed to check status: {}", e);
                    std::process::exit(1);
                }
            }
        }
        None => {
            // Default to start in foreground
            info!("Starting muxd on port {}", config.port);
            server::start_server(config).await?;
        }
    }
    
    Ok(())
}
