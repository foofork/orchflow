mod error;
mod protocol;
mod terminal;
mod session;
mod server;

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
            
            if !foreground {
                // TODO: Implement daemonization
                info!("Daemonization not yet implemented, running in foreground");
            }
            
            server::start_server(config).await?;
        }
        Some(Commands::Stop) => {
            info!("Stopping muxd");
            // TODO: Implement stop command
            println!("Stop command not yet implemented");
        }
        Some(Commands::Status) => {
            // TODO: Implement status command
            println!("Status command not yet implemented");
        }
        None => {
            // Default to start in foreground
            info!("Starting muxd on port {}", config.port);
            server::start_server(config).await?;
        }
    }
    
    Ok(())
}
