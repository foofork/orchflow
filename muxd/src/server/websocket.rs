use crate::error::{MuxdError, Result};
use crate::server::handler::RequestHandler;
use crate::session::SessionManager;
use crate::state::StatePersistence;
use crate::protocol::types::MuxdConfig;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
    routing::get,
    Router,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{mpsc, broadcast};
use tower_http::cors::CorsLayer;
use tracing::{debug, error, info, warn};

/// WebSocket server state
#[derive(Clone)]
struct ServerState {
    session_manager: Arc<SessionManager>,
    config: MuxdConfig,
    shutdown_tx: broadcast::Sender<()>,
}

/// Start the WebSocket server
pub async fn start_server(config: MuxdConfig) -> Result<()> {
    // Create state persistence
    let state_dir = std::path::PathBuf::from(&config.data_dir);
    let state_persistence = Arc::new(StatePersistence::new(state_dir));
    
    // Create session manager with persistence
    let session_manager = Arc::new(SessionManager::with_persistence(
        config.max_sessions,
        config.max_panes_per_session,
        state_persistence,
    ));
    
    let (shutdown_tx, _) = broadcast::channel(1);
    
    let state = ServerState {
        session_manager,
        config: config.clone(),
        shutdown_tx: shutdown_tx.clone(),
    };
    
    // Build router
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/ws", get(websocket_handler))
        .route("/health", get(health_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);
    
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Starting muxd server on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| MuxdError::ServerError {
            message: format!("Failed to bind to address: {}", e),
        })?;
    
    // Create the server future but don't await it yet
    let server = axum::serve(listener, app);
    
    // Wait for shutdown signal
    let graceful = server.with_graceful_shutdown(shutdown_signal(shutdown_tx));
    
    graceful
        .await
        .map_err(|e| MuxdError::ServerError {
            message: format!("Failed to start server: {}", e),
        })?;
    
    info!("Server shutdown complete");
    Ok(())
}

/// Shutdown signal handler
async fn shutdown_signal(shutdown_tx: broadcast::Sender<()>) {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    let mut shutdown_rx = shutdown_tx.subscribe();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, shutting down");
        }
        _ = terminate => {
            info!("Received terminate signal, shutting down");
        }
        _ = shutdown_rx.recv() => {
            info!("Received shutdown request, shutting down");
        }
    }
}

/// Root handler
async fn root_handler() -> &'static str {
    "muxd - Multiplexer Daemon"
}

/// Health check handler
async fn health_handler() -> &'static str {
    "OK"
}

/// WebSocket upgrade handler
async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<ServerState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, state: ServerState) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel();
    
    // Clone shutdown transmitter
    let shutdown_tx = state.shutdown_tx.clone();
    
    // Create request handler
    let handler = Arc::new(RequestHandler::new(
        state.session_manager.clone(),
        tx.clone(),
    ));
    
    // Task to send messages to client
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            // Check if this is a shutdown message
            if let Message::Text(ref text) = msg {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
                    if json.get("method") == Some(&serde_json::json!("_internal_shutdown")) {
                        info!("Received internal shutdown request");
                        let _ = shutdown_tx.send(());
                        break;
                    }
                }
            }
            
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });
    
    // Task to receive messages from client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    debug!("Received text message: {}", text);
                    
                    // Parse and handle JSON-RPC request
                    match serde_json::from_str::<serde_json::Value>(&text) {
                        Ok(json) => {
                            if let Err(e) = handler.handle_message(json).await {
                                error!("Error handling message: {}", e);
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse JSON: {}", e);
                            let error_response = serde_json::json!({
                                "jsonrpc": "2.0",
                                "error": {
                                    "code": -32700,
                                    "message": "Parse error"
                                },
                                "id": null
                            });
                            
                            if tx.send(Message::Text(error_response.to_string())).is_err() {
                                break;
                            }
                        }
                    }
                }
                Message::Binary(_) => {
                    warn!("Binary messages not supported");
                }
                Message::Close(_) => {
                    info!("Client disconnected");
                    break;
                }
                Message::Ping(_) | Message::Pong(_) => {
                    // Axum handles ping/pong automatically
                }
            }
        }
    });
    
    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        }
        _ = (&mut recv_task) => {
            send_task.abort();
        }
    }
    
    info!("WebSocket connection closed");
}