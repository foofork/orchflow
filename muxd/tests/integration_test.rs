use muxd::error::Result;
use muxd::protocol::PaneType;
use muxd::session::SessionManager;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::sleep;

#[tokio::test]
async fn test_terminal_session_integration() -> Result<()> {
    // Create session manager
    let session_manager = Arc::new(SessionManager::new(10, 20));
    
    // Create a new session
    let session_id = session_manager.create_session("test-session".to_string())?;
    
    // Create output channel
    let (tx, mut rx) = mpsc::unbounded_channel();
    
    // Create a terminal pane
    let pane = session_manager.create_pane(
        &session_id,
        PaneType::Terminal,
        tx,
    )?;
    
    // Verify pane was created
    assert!(session_manager.get_pane(&session_id, &pane.id).is_ok());
    
    // Start the terminal
    pane.start(Some("/bin/sh".to_string()), None, std::collections::HashMap::new(), None).await?;
    
    // Write to the terminal
    pane.write(b"echo 'Integration test'\n")?;
    
    // Wait for output
    sleep(Duration::from_millis(200)).await;
    
    // Check if we received output
    let mut has_output = false;
    while let Ok(data) = rx.try_recv() {
        let output = String::from_utf8_lossy(&data);
        if output.contains("Integration test") {
            has_output = true;
            break;
        }
    }
    assert!(has_output, "Expected output not received");
    
    // Resize the terminal
    pane.resize(100, 40)?;
    
    // Close the pane
    session_manager.kill_pane(&session_id, &pane.id)?;
    
    // Verify pane is closed
    assert!(session_manager.get_pane(&session_id, &pane.id).is_err());
    
    // Close the session
    session_manager.delete_session(&session_id)?;
    
    Ok(())
}

#[tokio::test]
async fn test_multiple_panes_in_session() -> Result<()> {
    let session_manager = Arc::new(SessionManager::new(10, 20));
    let session_id = session_manager.create_session("multi-pane-session".to_string())?;
    
    // Create multiple panes
    let (tx1, _rx1) = mpsc::unbounded_channel();
    let pane1 = session_manager.create_pane(
        &session_id,
        PaneType::Terminal,
        tx1,
    )?;
    
    let (tx2, _rx2) = mpsc::unbounded_channel();
    let pane2 = session_manager.create_pane(
        &session_id,
        PaneType::Terminal,
        tx2,
    )?;
    
    let (tx3, _rx3) = mpsc::unbounded_channel();
    let pane3 = session_manager.create_pane(
        &session_id,
        PaneType::Custom("editor".to_string()),
        tx3,
    )?;
    
    // List panes
    let panes = session_manager.list_panes(&session_id)?;
    assert_eq!(panes.len(), 3);
    
    // Set active pane
    session_manager.set_active_pane(&session_id, &pane2.id)?;
    
    Ok(())
}

#[tokio::test]
async fn test_session_persistence() -> Result<()> {
    let session_manager = Arc::new(SessionManager::new(10, 20));
    
    // Create session and panes
    let session_id = session_manager.create_session("persistent-session".to_string())?;
    let pane_id = {
        let (tx, _rx) = mpsc::unbounded_channel();
        let pane = session_manager.create_pane(
            &session_id,
            PaneType::Terminal,
            tx,
        )?;
        pane.id.clone()
    };
    
    // Write some data
    let pane = session_manager.get_pane(&session_id, &pane_id)?;
    pane.start(Some("/bin/sh".to_string()), None, std::collections::HashMap::new(), None).await?;
    pane.write(b"cd /tmp\n")?;
    pane.write(b"ls -la\n")?;
    
    // For now, just verify basic operations work
    // TODO: Implement session persistence when serialize/restore methods are added
    
    // Verify panes exist
    let panes = session_manager.list_panes(&session_id)?;
    assert_eq!(panes.len(), 1);
    assert_eq!(panes[0].id, pane_id);
    
    Ok(())
}

#[tokio::test]
async fn test_concurrent_pane_operations() -> Result<()> {
    let session_manager = Arc::new(SessionManager::new(20, 20));
    let session_id = session_manager.create_session("concurrent-session".to_string())?;
    
    // Create multiple panes concurrently
    let mut handles = vec![];
    
    for i in 0..10 {
        let sm = session_manager.clone();
        let sid = session_id.clone();
        
        let handle = tokio::spawn(async move {
            let (tx, _rx) = mpsc::unbounded_channel();
            sm.create_pane(
                &sid,
                PaneType::Terminal,
                tx,
            )
        });
        
        handles.push(handle);
    }
    
    // Wait for all to complete
    for handle in handles {
        assert!(handle.await.is_ok());
    }
    
    // Verify all panes were created
    let panes = session_manager.list_panes(&session_id)?;
    assert_eq!(panes.len(), 10);
    
    Ok(())
}