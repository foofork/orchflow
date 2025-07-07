use crate::error::{MuxdError, Result};
use crate::server::handler::RequestHandler;
use crate::session::SessionManager;
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
use tokio::sync::mpsc;
use tower_http::cors::CorsLayer;
use tracing::{debug, error, info, warn};

/// WebSocket server state
#[derive(Clone)]
struct ServerState {
    session_manager: Arc<SessionManager>,
    config: MuxdConfig,
}

/// Start the WebSocket server
pub async fn start_server(config: MuxdConfig) -> Result<()> {
    let session_manager = Arc::new(SessionManager::new(
        config.max_sessions,
        config.max_panes_per_session,
    ));
    
    let state = ServerState {
        session_manager,
        config: config.clone(),
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
    
    axum::serve(listener, app)
        .await
        .map_err(|e| MuxdError::ServerError {
            message: format!("Failed to start server: {}", e),
        })?;
    
    Ok(())
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
    
    // Create request handler
    let handler = Arc::new(RequestHandler::new(
        state.session_manager.clone(),
        tx.clone(),
    ));
    
    // Task to send messages to client
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
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