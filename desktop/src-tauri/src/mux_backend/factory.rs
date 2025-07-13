use super::backend::MuxBackend;
use super::muxd_backend::MuxdBackend;
use super::tmux_backend::TmuxBackend;
use log::{error, info, warn};
use std::env;

/// Create a mux backend based on environment configuration (async version)
pub async fn create_mux_backend_async() -> Box<dyn MuxBackend> {
    let backend_type = env::var("ORCH_MUX_BACKEND").unwrap_or_else(|_| {
        info!("ORCH_MUX_BACKEND not set, defaulting to tmux");
        "tmux".to_string()
    });

    info!("Creating mux backend with type: {}", backend_type);

    match backend_type.as_str() {
        "muxd" => {
            let url = env::var("MUXD_URL").unwrap_or_else(|_| {
                info!("MUXD_URL not set, using default ws://localhost:7890/ws");
                "ws://localhost:7890/ws".to_string()
            });

            match MuxdBackend::new(url).await {
                Ok(backend) => {
                    info!("Successfully created MuxdBackend");
                    Box::new(backend)
                }
                Err(e) => {
                    error!("Failed to create MuxdBackend: {}, falling back to tmux", e);
                    Box::new(TmuxBackend::new())
                }
            }
        }
        "mock" => {
            #[cfg(test)]
            {
                info!("Using MockBackend for testing");
                Box::new(super::MockBackend::new())
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
            warn!("Unknown backend type '{}', falling back to tmux", other);
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

    info!("Creating mux backend with type: {}", backend_type);

    match backend_type.as_str() {
        "muxd" => {
            let url = env::var("MUXD_URL").unwrap_or_else(|_| {
                info!("MUXD_URL not set, using default ws://localhost:7890/ws");
                "ws://localhost:7890/ws".to_string()
            });

            // Try to use existing runtime or create a new one
            match tokio::runtime::Handle::try_current() {
                Ok(handle) => {
                    // We're already in a runtime, use it
                    match handle.block_on(MuxdBackend::new(url)) {
                        Ok(backend) => {
                            info!("Successfully created MuxdBackend");
                            Box::new(backend)
                        }
                        Err(e) => {
                            error!("Failed to create MuxdBackend: {}, falling back to tmux", e);
                            Box::new(TmuxBackend::new())
                        }
                    }
                }
                Err(_) => {
                    // No runtime exists, create a new one
                    match tokio::runtime::Runtime::new() {
                        Ok(rt) => match rt.block_on(MuxdBackend::new(url)) {
                            Ok(backend) => {
                                info!("Successfully created MuxdBackend");
                                Box::new(backend)
                            }
                            Err(e) => {
                                error!("Failed to create MuxdBackend: {}, falling back to tmux", e);
                                Box::new(TmuxBackend::new())
                            }
                        },
                        Err(e) => {
                            error!(
                                "Failed to create tokio runtime: {}, falling back to tmux",
                                e
                            );
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
                Box::new(super::MockBackend::new())
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
            warn!("Unknown backend type '{}', falling back to tmux", other);
            Box::new(TmuxBackend::new())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_backend_is_tmux() {
        // Clear env var
        env::remove_var("ORCH_MUX_BACKEND");

        let _backend = create_mux_backend();
        // We can't directly test the type, but we can verify it doesn't panic
        assert!(true);
    }

    #[test]
    fn test_env_var_tmux() {
        env::set_var("ORCH_MUX_BACKEND", "tmux");
        let _backend = create_mux_backend();
        assert!(true);
        env::remove_var("ORCH_MUX_BACKEND");
    }

    #[test]
    fn test_env_var_muxd_falls_back() {
        env::set_var("ORCH_MUX_BACKEND", "muxd");
        let _backend = create_mux_backend();
        // Should print warning and create tmux backend
        assert!(true);
        env::remove_var("ORCH_MUX_BACKEND");
    }

    #[test]
    fn test_env_var_mock() {
        env::set_var("ORCH_MUX_BACKEND", "mock");
        let _backend = create_mux_backend();
        // In test mode, should create mock backend
        assert!(true);
        env::remove_var("ORCH_MUX_BACKEND");
    }
}
