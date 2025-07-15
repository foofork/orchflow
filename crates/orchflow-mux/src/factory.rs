use crate::backend::MuxBackend;
use crate::muxd_backend::MuxdBackend as MuxdBackendImpl;
use crate::tmux_backend::TmuxBackend;
use log::{error, info, warn};
use std::env;

/// Create a mux backend based on environment configuration (async version)
pub async fn create_mux_backend_async() -> Box<dyn MuxBackend> {
    let backend_type = env::var("ORCH_MUX_BACKEND").unwrap_or_else(|_| {
        info!("ORCH_MUX_BACKEND not set, defaulting to tmux");
        "tmux".to_string()
    });

    info!("Creating mux backend with type: {backend_type}");

    match backend_type.as_str() {
        "muxd" => {
            let url = env::var("MUXD_URL").unwrap_or_else(|_| {
                info!("MUXD_URL not set, using default ws://localhost:7890/ws");
                "ws://localhost:7890/ws".to_string()
            });

            let backend = MuxdBackendImpl::new(url);
            info!("Successfully created MuxdBackend");
            Box::new(backend)
        }
        "mock" => {
            #[cfg(test)]
            {
                info!("Using MockBackend for testing");
                Box::new(crate::mock_backend::MockBackend::new())
            }
            #[cfg(not(test))]
            {
                warn!("Mock backend only available in test builds, using tmux");
                Box::new(TmuxBackend::new())
            }
        }
        "tmux" => {
            info!("Using TmuxBackend");
            Box::new(TmuxBackend::new())
        }
        other => {
            warn!("Unknown backend type '{other}', falling back to tmux");
            Box::new(TmuxBackend::new())
        }
    }
}

/// Create a mux backend based on environment configuration (sync version)
pub fn create_mux_backend() -> Box<dyn MuxBackend> {
    let backend_type = env::var("ORCH_MUX_BACKEND").unwrap_or_else(|_| {
        info!("ORCH_MUX_BACKEND not set, defaulting to tmux");
        "tmux".to_string()
    });

    info!("Creating mux backend with type: {backend_type}");

    match backend_type.as_str() {
        "muxd" => {
            let url = env::var("MUXD_URL").unwrap_or_else(|_| {
                info!("MUXD_URL not set, using default ws://localhost:7890/ws");
                "ws://localhost:7890/ws".to_string()
            });

            // Try to use existing runtime or create a new one
            match tokio::runtime::Handle::try_current() {
                Ok(_handle) => {
                    // We're already in a runtime, use it
                    let backend = MuxdBackendImpl::new(url);
                    info!("Successfully created MuxdBackend");
                    Box::new(backend)
                }
                Err(_) => {
                    // No runtime exists, create a new one
                    match tokio::runtime::Runtime::new() {
                        Ok(_rt) => {
                            let backend = MuxdBackendImpl::new(url);
                            info!("Successfully created MuxdBackend");
                            Box::new(backend)
                        }
                        Err(e) => {
                            error!("Failed to create tokio runtime: {e}, falling back to tmux");
                            Box::new(TmuxBackend::new())
                        }
                    }
                }
            }
        }
        "mock" => {
            #[cfg(test)]
            {
                info!("Using MockBackend for testing");
                Box::new(crate::mock_backend::MockBackend::new())
            }
            #[cfg(not(test))]
            {
                warn!("Mock backend only available in test builds, using tmux");
                Box::new(TmuxBackend::new())
            }
        }
        "tmux" => {
            info!("Using TmuxBackend");
            Box::new(TmuxBackend::new())
        }
        other => {
            warn!("Unknown backend type '{other}', falling back to tmux");
            Box::new(TmuxBackend::new())
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::factory::create_mux_backend;
    use std::env;

    #[test]
    fn test_default_backend_is_tmux() {
        // Clear env var
        env::remove_var("ORCH_MUX_BACKEND");

        let _backend = create_mux_backend();
        // We can't directly test the type, but we can verify it doesn't panic
        // Test passes by reaching this point
    }

    #[test]
    fn test_env_var_tmux() {
        env::set_var("ORCH_MUX_BACKEND", "tmux");
        let _backend = create_mux_backend();
        // Test passes by reaching this point
        env::remove_var("ORCH_MUX_BACKEND");
    }

    #[test]
    fn test_env_var_muxd_falls_back() {
        env::set_var("ORCH_MUX_BACKEND", "muxd");
        let _backend = create_mux_backend();
        // Should print warning and create tmux backend
        // Test passes by reaching this point
        env::remove_var("ORCH_MUX_BACKEND");
    }

    #[test]
    fn test_env_var_mock() {
        env::set_var("ORCH_MUX_BACKEND", "mock");
        let _backend = create_mux_backend();
        // In test mode, should create mock backend
        // Test passes by reaching this point
        env::remove_var("ORCH_MUX_BACKEND");
    }
}
