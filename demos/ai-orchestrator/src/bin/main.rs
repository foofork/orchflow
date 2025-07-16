use orchflow_ai_demo::AIOrchestrator;
use clap::Parser;

#[derive(Parser, Debug)]
#[command(author, version, about = "AI Terminal Orchestrator Demo", long_about = None)]
struct Args {
    /// Task to orchestrate (optional - can also use interactive mode)
    task: Option<String>,
    
    /// Skip attaching to tmux session
    #[arg(long)]
    no_attach: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    
    println!("=== OrchFlow AI Terminal Orchestrator Demo ===\n");
    
    // Create and start the orchestrator
    let mut orchestrator = AIOrchestrator::new().await?;
    
    if args.no_attach {
        println!("Starting orchestrator without attaching...");
        println!("To attach manually: tmux attach -t ai-orchestrator");
    }
    
    // Start the orchestrator (creates tmux layout and starts processes)
    orchestrator.start().await?;
    
    // If a task was provided, send it directly
    if let Some(task) = args.task {
        println!("Sending task to orchestrator: {}", task);
        // In a real implementation, this would send to the orchestrator
        // For now, user needs to type in claude-code terminal
    }
    
    Ok(())
}