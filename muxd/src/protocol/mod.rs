pub mod cursor_api;
pub mod enhanced_types;
pub mod notification;
pub mod request;
pub mod response;
pub mod types;

pub use cursor_api::*;
pub use enhanced_types::*;
pub use types::*;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JSON-RPC 2.0 message wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Message {
    Request(Request),
    Response(Response),
    Notification(Notification),
}

/// JSON-RPC 2.0 request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    pub jsonrpc: String,
    pub id: RequestId,
    pub method: String,
    pub params: Value,
}

/// JSON-RPC 2.0 response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub jsonrpc: String,
    pub id: RequestId,
    #[serde(flatten)]
    pub result: ResponseResult,
}

/// Response result - either success or error
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResponseResult {
    Success { result: Value },
    Error { error: RpcError },
}

/// JSON-RPC 2.0 notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub jsonrpc: String,
    pub method: String,
    pub params: Value,
}

/// JSON-RPC 2.0 error object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// Request ID can be number or string
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum RequestId {
    Number(u64),
    String(String),
}

impl Default for Request {
    fn default() -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: RequestId::Number(0),
            method: String::new(),
            params: Value::Object(serde_json::Map::new()),
        }
    }
}

impl Request {
    pub fn new(method: impl Into<String>, params: Value) -> Self {
        Self {
            method: method.into(),
            params,
            ..Default::default()
        }
    }
    
    pub fn with_id(mut self, id: RequestId) -> Self {
        self.id = id;
        self
    }
}