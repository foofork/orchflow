// Demo program to test terminal session ID management functionality

use orchflow::simple_state_store::SimpleStateStore;
use orchflow::state_manager::{StateManager, PaneType};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔗 Testing Terminal Session ID Management");
    println!("======================================");
    
    // Initialize the state store and manager with in-memory database
    let state_store = SimpleStateStore::new()?;
    let state_manager = StateManager::new(Arc::new(state_store));
    
    // Test 1: Create a session
    println!("\n📝 Test 1: Creating test session");
    
    let created_session = state_manager.create_session("Test Session".to_string()).await;
    let session_id = match created_session {
        Ok(ref session) => {
            println!("✅ Created session: {}", session.id);
            session.id.clone()
        },
        Err(e) => {
            println!("❌ Failed to create session: {}", e);
            return Ok(());
        }
    };
    
    // Test 2: Create a pane in the session
    println!("\n📝 Test 2: Creating test pane in session");
    
    let created_pane = state_manager.create_pane(
        session_id.clone(),
        PaneType::Terminal,
        Some("tmux.0".to_string())
    ).await;
    let pane_id = match created_pane {
        Ok(ref pane) => {
            println!("✅ Created pane: {} in session: {}", pane.id, pane.session_id);
            pane.id.clone()
        },
        Err(e) => {
            println!("❌ Failed to create pane: {}", e);
            return Ok(());
        }
    };
    
    // Test 3: Verify we can get session ID from pane
    println!("\n🔍 Test 3: Testing session ID retrieval from pane");
    
    if let Some(retrieved_pane) = state_manager.get_pane(&pane_id).await {
        println!("✅ Retrieved pane successfully");
        println!("   Pane ID: {}", retrieved_pane.id);
        println!("   Session ID: {}", retrieved_pane.session_id);
        
        // Verify the session ID matches
        if retrieved_pane.session_id == session_id {
            println!("✅ Session ID matches expected value");
        } else {
            println!("❌ Session ID mismatch! Expected: {}, Got: {}", session_id, retrieved_pane.session_id);
        }
    } else {
        println!("❌ Failed to retrieve pane");
        return Ok(());
    }
    
    // Test 4: Test session ID extraction logic (simulate the fix)
    println!("\n🔧 Test 4: Testing session ID extraction logic");
    
    // Simulate the logic from the terminal handler
    let extracted_session_id = if let Some(pane) = state_manager.get_pane(&pane_id).await {
        pane.session_id
    } else {
        println!("⚠️  Could not find pane {} for command history", pane_id);
        String::new()
    };
    
    if !extracted_session_id.is_empty() {
        println!("✅ Successfully extracted session ID: {}", extracted_session_id);
        println!("   This would be used for command history tracking");
    } else {
        println!("❌ Failed to extract session ID");
    }
    
    // Test 5: Test with non-existent pane (edge case)
    println!("\n⚠️  Test 5: Testing with non-existent pane");
    
    let session_id_missing = if let Some(pane) = state_manager.get_pane("non-existent-pane").await {
        pane.session_id
    } else {
        println!("⚠️  Could not find pane non-existent-pane for command history (expected)");
        String::new()
    };
    
    if session_id_missing.is_empty() {
        println!("✅ Correctly handled missing pane with empty session ID fallback");
    } else {
        println!("❌ Unexpected session ID for missing pane: {}", session_id_missing);
    }
    
    println!("\n🎉 Terminal session ID management tests completed!");
    println!("✨ Session ID can now be properly tracked for command history");
    
    Ok(())
}