// Example implementation of terminal batch operations
// This file demonstrates the concrete implementation patterns

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, RwLock};
use futures::stream::{StreamExt, Stream};
use serde::{Serialize, Deserialize};
use tauri::State;

// ===== Data Structures =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTerminalOperation {
    pub terminal_id: String,
    pub operations: Vec<TerminalOperation>,
    pub priority: OperationPriority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum TerminalOperation {
    SendInput(String),
    SendBinary(Vec<u8>),
    Resize { rows: u16, cols: u16 },
    SetMode(String),
    Clear,
    ScrollTo(i32),
    Paste(String),
    SpecialKey(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperationPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Serialize)]
pub struct BatchOperationResult {
    pub total_operations: usize,
    pub successful: usize,
    pub failed: usize,
    pub duration_ms: u64,
    pub errors: Vec<OperationError>,
}

#[derive(Debug, Serialize)]
pub struct OperationError {
    pub terminal_id: String,
    pub operation_index: usize,
    pub error: String,
}

// ===== Tauri Commands =====

#[tauri::command]
pub async fn terminal_batch_operations(
    operations: Vec<BatchTerminalOperation>,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<BatchOperationResult, String> {
    let start = Instant::now();
    let mut errors = Vec::new();
    let total = operations.len();
    
    // Sort operations by priority
    let mut sorted_ops = operations;
    sorted_ops.sort_by_key(|op| match op.priority {
        OperationPriority::Critical => 0,
        OperationPriority::High => 1,
        OperationPriority::Normal => 2,
        OperationPriority::Low => 3,
    });
    
    // Process operations with controlled concurrency
    let semaphore = Arc::new(tokio::sync::Semaphore::new(4));
    let results = futures::future::join_all(
        sorted_ops.into_iter().map(|batch_op| {
            let manager = manager.inner().clone();
            let semaphore = semaphore.clone();
            
            async move {
                let _permit = semaphore.acquire().await.unwrap();
                process_batch_operation(batch_op, &manager).await
            }
        })
    ).await;
    
    // Collect results
    let successful = results.iter().filter(|r| r.is_ok()).count();
    let failed = results.iter().filter(|r| r.is_err()).count();
    
    // Collect errors
    for (idx, result) in results.into_iter().enumerate() {
        if let Err(e) = result {
            errors.push(OperationError {
                terminal_id: "unknown".to_string(), // Would be better to track this
                operation_index: idx,
                error: e.to_string(),
            });
        }
    }
    
    Ok(BatchOperationResult {
        total_operations: total,
        successful,
        failed,
        duration_ms: start.elapsed().as_millis() as u64,
        errors,
    })
}

// ===== Processing Logic =====

async fn process_batch_operation(
    batch: BatchTerminalOperation,
    manager: &TerminalStreamManager,
) -> Result<(), crate::error::OrchflowError> {
    for operation in batch.operations {
        match operation {
            TerminalOperation::SendInput(text) => {
                manager.send_input(
                    &batch.terminal_id,
                    TerminalInput::text(text)
                ).await?;
            }
            
            TerminalOperation::SendBinary(data) => {
                manager.send_input(
                    &batch.terminal_id,
                    TerminalInput::Binary(data)
                ).await?;
            }
            
            TerminalOperation::Resize { rows, cols } => {
                manager.resize_terminal(&batch.terminal_id, rows, cols).await?;
            }
            
            TerminalOperation::SetMode(mode) => {
                manager.send_control(
                    &batch.terminal_id,
                    ControlMessage::ModeChange { mode }
                ).await?;
            }
            
            TerminalOperation::Clear => {
                manager.clear_terminal(&batch.terminal_id).await?;
            }
            
            TerminalOperation::ScrollTo(position) => {
                manager.scroll_terminal(&batch.terminal_id, position).await?;
            }
            
            TerminalOperation::Paste(text) => {
                // Handle paste as a special binary operation to preserve formatting
                manager.send_input(
                    &batch.terminal_id,
                    TerminalInput::paste(text)
                ).await?;
            }
            
            TerminalOperation::SpecialKey(key) => {
                manager.send_input(
                    &batch.terminal_id,
                    TerminalInput::key(key)
                ).await?;
            }
        }
        
        // Small delay between operations to avoid overwhelming the terminal
        if batch.priority != OperationPriority::Critical {
            tokio::time::sleep(Duration::from_micros(100)).await;
        }
    }
    
    Ok(())
}

// ===== Optimized Bulk Operations =====

#[tauri::command]
pub async fn terminal_send_batch_input(
    inputs: Vec<(String, String)>, // (terminal_id, input)
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<usize, String> {
    let mut successful = 0;
    
    // Group by terminal for efficiency
    let mut by_terminal: std::collections::HashMap<String, Vec<String>> = 
        std::collections::HashMap::new();
    
    for (terminal_id, input) in inputs {
        by_terminal.entry(terminal_id).or_insert_with(Vec::new).push(input);
    }
    
    // Process each terminal's inputs
    for (terminal_id, inputs) in by_terminal {
        // Concatenate inputs with minimal delay
        let combined = inputs.join("");
        
        if let Ok(_) = manager.send_input(
            &terminal_id,
            TerminalInput::text(combined)
        ).await {
            successful += inputs.len();
        }
    }
    
    Ok(successful)
}

// ===== Streaming with Flow Control =====

pub struct TerminalOutputStream {
    terminal_id: String,
    receiver: mpsc::Receiver<TerminalOutput>,
    buffer: Vec<TerminalOutput>,
    flow_control: Arc<AtomicBool>,
}

impl TerminalOutputStream {
    pub fn new(
        terminal_id: String,
        receiver: mpsc::Receiver<TerminalOutput>,
    ) -> Self {
        Self {
            terminal_id,
            receiver,
            buffer: Vec::with_capacity(100),
            flow_control: Arc::new(AtomicBool::new(true)),
        }
    }
    
    pub async fn read_with_backpressure(&mut self, max_items: usize) -> Vec<TerminalOutput> {
        // Check flow control
        if !self.flow_control.load(Ordering::Relaxed) {
            return Vec::new();
        }
        
        // Fill buffer from receiver
        while self.buffer.len() < max_items {
            match self.receiver.try_recv() {
                Ok(output) => self.buffer.push(output),
                Err(_) => break,
            }
        }
        
        // Return requested items
        let drain_count = self.buffer.len().min(max_items);
        self.buffer.drain(..drain_count).collect()
    }
    
    pub fn pause(&self) {
        self.flow_control.store(false, Ordering::Relaxed);
    }
    
    pub fn resume(&self) {
        self.flow_control.store(true, Ordering::Relaxed);
    }
}

// ===== Performance Monitoring =====

pub struct TerminalMetrics {
    operations_per_second: Arc<AtomicU64>,
    bytes_per_second: Arc<AtomicU64>,
    error_count: Arc<AtomicU64>,
    last_reset: Arc<RwLock<Instant>>,
}

impl TerminalMetrics {
    pub fn new() -> Self {
        Self {
            operations_per_second: Arc::new(AtomicU64::new(0)),
            bytes_per_second: Arc::new(AtomicU64::new(0)),
            error_count: Arc::new(AtomicU64::new(0)),
            last_reset: Arc::new(RwLock::new(Instant::now())),
        }
    }
    
    pub fn record_operation(&self, bytes: usize) {
        self.operations_per_second.fetch_add(1, Ordering::Relaxed);
        self.bytes_per_second.fetch_add(bytes as u64, Ordering::Relaxed);
    }
    
    pub fn record_error(&self) {
        self.error_count.fetch_add(1, Ordering::Relaxed);
    }
    
    pub async fn get_metrics(&self) -> PerformanceMetrics {
        let elapsed = self.last_reset.read().await.elapsed().as_secs_f64();
        
        let ops = self.operations_per_second.load(Ordering::Relaxed);
        let bytes = self.bytes_per_second.load(Ordering::Relaxed);
        let errors = self.error_count.load(Ordering::Relaxed);
        
        PerformanceMetrics {
            operations_per_second: (ops as f64 / elapsed) as u64,
            bytes_per_second: (bytes as f64 / elapsed) as u64,
            error_rate: (errors as f64 / elapsed) as f64,
            total_operations: ops,
            total_bytes: bytes,
            total_errors: errors,
        }
    }
    
    pub async fn reset(&self) {
        self.operations_per_second.store(0, Ordering::Relaxed);
        self.bytes_per_second.store(0, Ordering::Relaxed);
        self.error_count.store(0, Ordering::Relaxed);
        *self.last_reset.write().await = Instant::now();
    }
}

#[derive(Debug, Serialize)]
pub struct PerformanceMetrics {
    pub operations_per_second: u64,
    pub bytes_per_second: u64,
    pub error_rate: f64,
    pub total_operations: u64,
    pub total_bytes: u64,
    pub total_errors: u64,
}

// ===== Tests =====

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_batch_priority_ordering() {
        let ops = vec![
            BatchTerminalOperation {
                terminal_id: "t1".to_string(),
                operations: vec![TerminalOperation::SendInput("low".to_string())],
                priority: OperationPriority::Low,
            },
            BatchTerminalOperation {
                terminal_id: "t2".to_string(),
                operations: vec![TerminalOperation::SendInput("critical".to_string())],
                priority: OperationPriority::Critical,
            },
            BatchTerminalOperation {
                terminal_id: "t3".to_string(),
                operations: vec![TerminalOperation::SendInput("normal".to_string())],
                priority: OperationPriority::Normal,
            },
        ];
        
        // Verify priority ordering logic
        let mut sorted = ops.clone();
        sorted.sort_by_key(|op| match op.priority {
            OperationPriority::Critical => 0,
            OperationPriority::High => 1,
            OperationPriority::Normal => 2,
            OperationPriority::Low => 3,
        });
        
        assert_eq!(sorted[0].priority, OperationPriority::Critical);
        assert_eq!(sorted[1].priority, OperationPriority::Normal);
        assert_eq!(sorted[2].priority, OperationPriority::Low);
    }
    
    #[tokio::test]
    async fn test_metrics_calculation() {
        let metrics = TerminalMetrics::new();
        
        // Record some operations
        for _ in 0..10 {
            metrics.record_operation(100);
        }
        metrics.record_error();
        
        // Wait a bit
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        let perf = metrics.get_metrics().await;
        assert_eq!(perf.total_operations, 10);
        assert_eq!(perf.total_bytes, 1000);
        assert_eq!(perf.total_errors, 1);
    }
}

// ===== Additional Utilities =====

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

/// Helper to coalesce rapid terminal updates
pub struct UpdateCoalescer {
    pending: Arc<RwLock<Option<TerminalOutput>>>,
    delay: Duration,
}

impl UpdateCoalescer {
    pub fn new(delay: Duration) -> Self {
        Self {
            pending: Arc::new(RwLock::new(None)),
            delay,
        }
    }
    
    pub async fn add(&self, output: TerminalOutput) -> Option<TerminalOutput> {
        let mut pending = self.pending.write().await;
        
        if pending.is_some() {
            // Merge with existing
            if let Some(existing) = pending.as_mut() {
                existing.data.push_str(&output.data);
            }
            None
        } else {
            // First update, start timer
            *pending = Some(output);
            
            let pending_clone = self.pending.clone();
            let delay = self.delay;
            
            tokio::spawn(async move {
                tokio::time::sleep(delay).await;
                let mut pending = pending_clone.write().await;
                pending.take()
            });
            
            None
        }
    }
}