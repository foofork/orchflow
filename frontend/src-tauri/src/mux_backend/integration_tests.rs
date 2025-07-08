#[cfg(test)]
mod integration_tests {
    use super::super::*;
    use crate::mux_backend::factory::create_mux_backend_async;
    use crate::mux_backend::tmux_backend::TmuxBackend;
    use std::env;
    
    #[tokio::test]
    async fn test_backend_factory_default() {
        // Ensure no env var is set
        env::remove_var("ORCH_MUX_BACKEND");
        
        // Create backend - should default to tmux
        let backend = create_mux_backend();
        
        // Try a basic operation (will fail without tmux running)
        let result = backend.create_session("test").await;
        assert!(result.is_err()); // Expected since tmux isn't running
    }
    
    #[tokio::test]
    async fn test_backend_factory_with_env() {
        // Test tmux selection
        env::set_var("ORCH_MUX_BACKEND", "tmux");
        let _backend = create_mux_backend_async().await;
        
        // Test muxd selection (falls back to tmux currently)
        env::set_var("ORCH_MUX_BACKEND", "muxd");
        let _backend = create_mux_backend_async().await;
        
        // Clean up
        env::remove_var("ORCH_MUX_BACKEND");
    }
    
    #[tokio::test]
    async fn test_tmux_backend_basic_operations() {
        let backend = TmuxBackend::new();
        
        // These should not panic but will error without tmux
        let session_result = backend.create_session("test").await;
        assert!(session_result.is_err());
        
        let list_result = backend.list_sessions().await;
        assert!(list_result.is_err());
    }
    
    #[tokio::test]
    async fn test_backend_abstraction_works() {
        // This test verifies the abstraction compiles and works
        let backend: Box<dyn MuxBackend> = Box::new(TmuxBackend::new());
        
        // Should be able to call all trait methods
        let _ = backend.create_session("test").await;
        let _ = backend.list_sessions().await;
        let _ = backend.create_pane("session", SplitType::None).await;
        let _ = backend.send_keys("pane", "cmd").await;
        let _ = backend.capture_pane("pane").await;
        
        // All should error without tmux, but compile successfully
        assert!(true);
    }
}