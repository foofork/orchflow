// Configuration error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum ConfigError {
    #[error("Configuration error: {key} - {reason}")]
    GenericError { key: String, reason: String },
    
    #[error("Configuration error in {component}: {reason}")]
    ComponentError { component: String, reason: String },
    
    #[error("Invalid configuration value: {key} = {value} - {reason}")]
    InvalidValue { key: String, value: String, reason: String },
}

impl ConfigError {
    /// Helper function to create generic config error
    pub fn generic_error(key: &str, reason: &str) -> Self {
        Self::GenericError {
            key: key.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create component config error
    pub fn component_error(component: &str, reason: &str) -> Self {
        Self::ComponentError {
            component: component.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create invalid value error
    pub fn invalid_value(key: &str, value: &str, reason: &str) -> Self {
        Self::InvalidValue {
            key: key.to_string(),
            value: value.to_string(),
            reason: reason.to_string(),
        }
    }
}