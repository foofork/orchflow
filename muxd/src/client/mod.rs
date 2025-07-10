use crate::error::{MuxdError, Result};
use crate::protocol::{Request, Response, RequestId, ResponseResult};
use serde_json::{json, Value};
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};
use futures_util::{StreamExt, SinkExt};
use std::time::Duration;
use tokio::time::timeout;

pub struct MuxdClient {
    ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
}

impl MuxdClient {
    /// Connect to muxd daemon
    pub async fn connect(port: u16) -> Result<Self> {
        let url = format!("ws://127.0.0.1:{}/ws", port);
        
        let (ws_stream, _) = timeout(
            Duration::from_secs(5),
            connect_async(&url)
        )
        .await
        .map_err(|_| MuxdError::ConnectionError { 
            reason: format!("Connection timeout - is muxd running on port {}?", port)
        })?
        .map_err(|e| MuxdError::ConnectionError { 
            reason: format!("Failed to connect to muxd: {}", e) 
        })?;
        
        Ok(Self { ws_stream })
    }
    
    /// Send a request and wait for response
    pub async fn request(&mut self, method: &str, params: Value) -> Result<Response> {
        let request = Request {
            jsonrpc: "2.0".to_string(),
            id: RequestId::Number(1),
            method: method.to_string(),
            params,
        };
        
        let message = Message::Text(serde_json::to_string(&request)?);
        self.ws_stream.send(message).await
            .map_err(|e| MuxdError::ConnectionError { 
                reason: format!("Failed to send request: {}", e) 
            })?;
        
        // Wait for response
        if let Some(msg) = self.ws_stream.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    let response: Response = serde_json::from_str(&text)?;
                    Ok(response)
                }
                Ok(Message::Close(_)) => {
                    Err(MuxdError::ConnectionError { 
                        reason: "Connection closed by server".to_string() 
                    })
                }
                Err(e) => {
                    Err(MuxdError::ConnectionError { 
                        reason: format!("WebSocket error: {}", e) 
                    })
                }
                _ => {
                    Err(MuxdError::ConnectionError { 
                        reason: "Unexpected message type".to_string() 
                    })
                }
            }
        } else {
            Err(MuxdError::ConnectionError { 
                reason: "No response from server".to_string() 
            })
        }
    }
    
    /// Get server status
    pub async fn get_status(&mut self) -> Result<Value> {
        let response = self.request("server_status", json!({})).await?;
        
        match response.result {
            ResponseResult::Success { result } => Ok(result),
            ResponseResult::Error { error } => {
                Err(MuxdError::ServerError { 
                    message: error.message 
                })
            }
        }
    }
    
    /// Request server shutdown
    pub async fn shutdown(&mut self) -> Result<()> {
        let response = self.request("server_shutdown", json!({})).await?;
        
        match response.result {
            ResponseResult::Success { .. } => Ok(()),
            ResponseResult::Error { error } => {
                Err(MuxdError::ServerError { 
                    message: error.message 
                })
            }
        }
    }
    
    /// Close the client connection
    pub async fn close(mut self) -> Result<()> {
        self.ws_stream.close(None).await
            .map_err(|e| MuxdError::ConnectionError { 
                reason: format!("Failed to close connection: {}", e) 
            })?;
        Ok(())
    }
}

/// Check if muxd is running on the given port
pub async fn check_daemon_status(port: u16) -> Result<Value> {
    match MuxdClient::connect(port).await {
        Ok(mut client) => {
            let status = client.get_status().await?;
            let _ = client.close().await;
            Ok(status)
        }
        Err(_) => {
            Ok(json!({
                "running": false,
                "port": port
            }))
        }
    }
}

/// Stop the muxd daemon
pub async fn stop_daemon(port: u16) -> Result<()> {
    let mut client = MuxdClient::connect(port).await?;
    client.shutdown().await?;
    let _ = client.close().await;
    Ok(())
}