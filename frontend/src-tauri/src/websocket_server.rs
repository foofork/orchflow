use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::orchestrator::{Orchestrator, Action, Event};

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    method: String,
    params: Option<Value>,
    id: Option<Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
    id: Option<Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

#[derive(Debug, Serialize)]
struct EventNotification {
    jsonrpc: String,
    method: String,
    params: EventParams,
}

#[derive(Debug, Serialize)]
struct EventParams {
    event: Event,
}

pub struct WebSocketServer {
    orchestrator: Arc<Orchestrator>,
    port: u16,
}

impl WebSocketServer {
    pub fn new(orchestrator: Arc<Orchestrator>, port: u16) -> Self {
        Self { orchestrator, port }
    }
    
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let addr = format!("127.0.0.1:{}", self.port);
        let listener = TcpListener::bind(&addr).await?;
        println!("WebSocket server listening on ws://{}", addr);
        
        while let Ok((stream, _)) = listener.accept().await {
            let orchestrator = self.orchestrator.clone();
            tokio::spawn(handle_connection(stream, orchestrator));
        }
        
        Ok(())
    }
}

async fn handle_connection(stream: TcpStream, orchestrator: Arc<Orchestrator>) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("Failed to accept WebSocket connection: {}", e);
            return;
        }
    };
    
    println!("New WebSocket connection established");
    
    let (ws_sender, mut ws_receiver) = ws_stream.split();
    
    // Create a channel to send messages to the WebSocket
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
    
    // Spawn task to handle sending messages
    let mut ws_sender = ws_sender;
    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_sender.send(message).await.is_err() {
                break;
            }
        }
    });
    
    // Subscribe to orchestrator events
    let mut event_rx = orchestrator.event_tx.subscribe();
    let tx_events = tx.clone();
    
    // Spawn task to forward events to client
    let event_task = tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            let notification = EventNotification {
                jsonrpc: "2.0".to_string(),
                method: "orchestrator.event".to_string(),
                params: EventParams { event },
            };
            
            if let Ok(json) = serde_json::to_string(&notification) {
                if tx_events.send(Message::Text(json)).is_err() {
                    break;
                }
            }
        }
    });
    
    // Handle incoming messages
    while let Some(msg) = ws_receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                let response = handle_request(&text, &orchestrator).await;
                if let Ok(json) = serde_json::to_string(&response) {
                    // Send response through channel
                    if tx.send(Message::Text(json)).is_err() {
                        eprintln!("Failed to send response");
                        break;
                    }
                }
            }
            Ok(Message::Close(_)) => {
                println!("Client disconnected");
                break;
            }
            Err(e) => {
                eprintln!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
    
    // Clean up
    send_task.abort();
    event_task.abort();
}

async fn handle_request(text: &str, orchestrator: &Arc<Orchestrator>) -> JsonRpcResponse {
    let request: JsonRpcRequest = match serde_json::from_str(text) {
        Ok(req) => req,
        Err(e) => {
            return JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                result: None,
                error: Some(JsonRpcError {
                    code: -32700,
                    message: format!("Parse error: {}", e),
                    data: None,
                }),
                id: None,
            };
        }
    };
    
    let id = request.id.clone();
    
    match request.method.as_str() {
        "execute" => {
            if let Some(params) = request.params {
                if let Ok(action) = serde_json::from_value::<Action>(params["action"].clone()) {
                    match orchestrator.execute_action(action).await {
                        Ok(result) => JsonRpcResponse {
                            jsonrpc: "2.0".to_string(),
                            result: Some(result),
                            error: None,
                            id,
                        },
                        Err(e) => JsonRpcResponse {
                            jsonrpc: "2.0".to_string(),
                            result: None,
                            error: Some(JsonRpcError {
                                code: -32603,
                                message: e,
                                data: None,
                            }),
                            id,
                        },
                    }
                } else {
                    JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        result: None,
                        error: Some(JsonRpcError {
                            code: -32602,
                            message: "Invalid params: missing or invalid action".to_string(),
                            data: None,
                        }),
                        id,
                    }
                }
            } else {
                JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    result: None,
                    error: Some(JsonRpcError {
                        code: -32602,
                        message: "Invalid params".to_string(),
                        data: None,
                    }),
                    id,
                }
            }
        }
        
        "subscribe" => {
            // For now, all clients receive all events
            // In future, could implement filtering
            JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                result: Some(serde_json::json!({ "status": "subscribed" })),
                error: None,
                id,
            }
        }
        
        _ => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            result: None,
            error: Some(JsonRpcError {
                code: -32601,
                message: format!("Method not found: {}", request.method),
                data: None,
            }),
            id,
        },
    }
}

pub async fn start_websocket_server(orchestrator: Arc<Orchestrator>, port: u16) {
    let server = WebSocketServer::new(orchestrator, port);
    if let Err(e) = server.start().await {
        eprintln!("WebSocket server error: {}", e);
    }
}