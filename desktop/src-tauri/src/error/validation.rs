// Input validation error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum ValidationError {
    #[error("Validation failed: {field} - {reason}")]
    FieldValidation { field: String, reason: String },
    
    #[error("Invalid input: {input} - {reason}")]
    InvalidInput { input: String, reason: String },
    
    #[error("Constraint violation: {constraint} - {reason}")]
    ConstraintViolation { constraint: String, reason: String },
}

impl ValidationError {
    /// Helper function to create field validation error
    pub fn field_validation(field: &str, reason: &str) -> Self {
        Self::FieldValidation {
            field: field.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create invalid input error
    pub fn invalid_input(input: &str, reason: &str) -> Self {
        Self::InvalidInput {
            input: input.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create constraint violation error
    pub fn constraint_violation(constraint: &str, reason: &str) -> Self {
        Self::ConstraintViolation {
            constraint: constraint.to_string(),
            reason: reason.to_string(),
        }
    }
}