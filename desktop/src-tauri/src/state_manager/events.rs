// State change events and broadcasting

use tokio::sync::broadcast;
use super::types::StateEvent;

#[derive(Clone)]
pub struct EventManager {
    event_tx: broadcast::Sender<StateEvent>,
}

impl EventManager {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(1024);
        Self { event_tx }
    }
    
    /// Subscribe to state events
    pub fn subscribe(&self) -> broadcast::Receiver<StateEvent> {
        self.event_tx.subscribe()
    }
    
    /// Emit a state event
    pub fn emit(&self, event: StateEvent) {
        if let Err(e) = self.event_tx.send(event) {
            // Only log if there are no receivers (which is normal)
            if e.0.to_string().contains("channel closed") {
                eprintln!("Failed to send state event: {}", e);
            }
        }
    }
    
    /// Get the number of active subscribers
    pub fn subscriber_count(&self) -> usize {
        self.event_tx.receiver_count()
    }
    
    /// Check if there are any active subscribers
    pub fn has_subscribers(&self) -> bool {
        self.subscriber_count() > 0
    }
}

impl Default for EventManager {
    fn default() -> Self {
        Self::new()
    }
}