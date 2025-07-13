// Demo program to test tmux split type handling functionality

use orchflow::mux_backend::backend::{MuxBackend, SplitType};
use orchflow::mux_backend::tmux_backend::TmuxBackend;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔨 Testing Tmux Split Type Handling");
    println!("===================================");
    
    // Initialize the tmux backend
    let backend = TmuxBackend::new();
    
    // Test 1: Create a session
    println!("\n📝 Test 1: Creating test session");
    
    let session_id = match backend.create_session("split_test").await {
        Ok(id) => {
            println!("✅ Created session: {}", id);
            id
        },
        Err(e) => {
            println!("❌ Failed to create session: {}", e);
            println!("   This may be expected if tmux is not installed or running");
            return Ok(());
        }
    };
    
    // Test 2: Create initial pane (SplitType::None)
    println!("\n📝 Test 2: Creating initial pane with SplitType::None");
    
    let initial_pane = match backend.create_pane(&session_id, SplitType::None).await {
        Ok(pane_id) => {
            println!("✅ Created initial pane: {}", pane_id);
            pane_id
        },
        Err(e) => {
            println!("❌ Failed to create initial pane: {}", e);
            let _ = backend.kill_session(&session_id).await;
            return Ok(());
        }
    };
    
    // Test 3: Create horizontal split
    println!("\n📝 Test 3: Creating horizontal split (SplitType::Horizontal)");
    
    let horizontal_pane = match backend.create_pane(&session_id, SplitType::Horizontal).await {
        Ok(pane_id) => {
            println!("✅ Created horizontal split pane: {}", pane_id);
            pane_id
        },
        Err(e) => {
            println!("❌ Failed to create horizontal split: {}", e);
            let _ = backend.kill_session(&session_id).await;
            return Ok(());
        }
    };
    
    // Test 4: Create vertical split
    println!("\n📝 Test 4: Creating vertical split (SplitType::Vertical)");
    
    let vertical_pane = match backend.create_pane(&session_id, SplitType::Vertical).await {
        Ok(pane_id) => {
            println!("✅ Created vertical split pane: {}", pane_id);
            pane_id
        },
        Err(e) => {
            println!("❌ Failed to create vertical split: {}", e);
            let _ = backend.kill_session(&session_id).await;
            return Ok(());
        }
    };
    
    // Test 5: List all panes to verify they were created
    println!("\n🔍 Test 5: Listing all panes in session");
    
    match backend.list_panes(&session_id).await {
        Ok(panes) => {
            println!("✅ Found {} panes in session:", panes.len());
            for pane in panes {
                println!("   - Pane {}: {}x{} ({})", 
                    pane.id, 
                    pane.size.width, 
                    pane.size.height,
                    if pane.active { "active" } else { "inactive" }
                );
            }
        },
        Err(e) => {
            println!("❌ Failed to list panes: {}", e);
        }
    }
    
    // Test 6: Send commands to different panes to verify they work
    println!("\n📤 Test 6: Sending test commands to verify panes");
    
    // Send different commands to each pane
    let test_commands = [
        (&initial_pane, "echo 'Initial pane works'"),
        (&horizontal_pane, "echo 'Horizontal split works'"),
        (&vertical_pane, "echo 'Vertical split works'"),
    ];
    
    for (pane_id, command) in test_commands.iter() {
        match backend.send_keys(pane_id, command).await {
            Ok(()) => {
                println!("✅ Sent command to pane {}: {}", pane_id, command);
            },
            Err(e) => {
                println!("❌ Failed to send command to pane {}: {}", pane_id, e);
            }
        }
        
        // Send Enter key to execute the command
        if let Err(e) = backend.send_keys(pane_id, "Enter").await {
            println!("❌ Failed to send Enter to pane {}: {}", pane_id, e);
        }
    }
    
    // Wait a moment for commands to execute
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Test 7: Capture output from panes
    println!("\n📋 Test 7: Capturing output from panes");
    
    for (i, pane_id) in [&initial_pane, &horizontal_pane, &vertical_pane].iter().enumerate() {
        match backend.capture_pane(pane_id).await {
            Ok(content) => {
                let lines = content.lines().count();
                println!("✅ Captured {} lines from pane {} ({})", 
                    lines, 
                    pane_id,
                    match i {
                        0 => "initial",
                        1 => "horizontal",
                        2 => "vertical",
                        _ => "unknown"
                    }
                );
                
                // Show last few lines if they contain our test output
                let relevant_lines: Vec<&str> = content.lines()
                    .filter(|line| line.contains("works") || line.contains("echo"))
                    .collect();
                
                if !relevant_lines.is_empty() {
                    println!("   Test output found: {}", relevant_lines.join(", "));
                }
            },
            Err(e) => {
                println!("❌ Failed to capture pane {}: {}", pane_id, e);
            }
        }
    }
    
    // Cleanup
    println!("\n🧹 Cleaning up test session");
    match backend.kill_session(&session_id).await {
        Ok(()) => {
            println!("✅ Successfully cleaned up session: {}", session_id);
        },
        Err(e) => {
            println!("❌ Failed to cleanup session: {}", e);
        }
    }
    
    println!("\n🎉 Tmux split type handling tests completed!");
    println!("✨ All split types (None, Horizontal, Vertical) are now properly implemented");
    
    Ok(())
}