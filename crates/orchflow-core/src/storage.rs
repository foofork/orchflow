use async_trait::async_trait;
use serde_json::Value;

/// Transport-agnostic storage trait for state persistence
#[async_trait]
pub trait StateStore: Send + Sync {
    /// Store a value with a key
    async fn set(&self, key: &str, value: Value) -> Result<(), String>;

    /// Get a value by key
    async fn get(&self, key: &str) -> Result<Option<Value>, String>;

    /// Delete a value by key
    async fn delete(&self, key: &str) -> Result<(), String>;

    /// List all keys with optional prefix
    async fn list_keys(&self, prefix: Option<&str>) -> Result<Vec<String>, String>;

    /// Batch get multiple values
    async fn get_many(&self, keys: &[String]) -> Result<Vec<Option<Value>>, String>;

    /// Batch set multiple values
    async fn set_many(&self, items: &[(String, Value)]) -> Result<(), String>;

    /// Clear all data with optional prefix
    async fn clear(&self, prefix: Option<&str>) -> Result<(), String>;
}

/// In-memory implementation for testing
pub struct MemoryStore {
    data: tokio::sync::RwLock<std::collections::HashMap<String, Value>>,
}

impl Default for MemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

impl MemoryStore {
    pub fn new() -> Self {
        Self {
            data: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        }
    }
}

#[async_trait]
impl StateStore for MemoryStore {
    async fn set(&self, key: &str, value: Value) -> Result<(), String> {
        let mut data = self.data.write().await;
        data.insert(key.to_string(), value);
        Ok(())
    }

    async fn get(&self, key: &str) -> Result<Option<Value>, String> {
        let data = self.data.read().await;
        Ok(data.get(key).cloned())
    }

    async fn delete(&self, key: &str) -> Result<(), String> {
        let mut data = self.data.write().await;
        data.remove(key);
        Ok(())
    }

    async fn list_keys(&self, prefix: Option<&str>) -> Result<Vec<String>, String> {
        let data = self.data.read().await;
        let keys: Vec<String> = if let Some(prefix) = prefix {
            data.keys()
                .filter(|k| k.starts_with(prefix))
                .cloned()
                .collect()
        } else {
            data.keys().cloned().collect()
        };
        Ok(keys)
    }

    async fn get_many(&self, keys: &[String]) -> Result<Vec<Option<Value>>, String> {
        let data = self.data.read().await;
        let values = keys.iter().map(|k| data.get(k).cloned()).collect();
        Ok(values)
    }

    async fn set_many(&self, items: &[(String, Value)]) -> Result<(), String> {
        let mut data = self.data.write().await;
        for (key, value) in items {
            data.insert(key.clone(), value.clone());
        }
        Ok(())
    }

    async fn clear(&self, prefix: Option<&str>) -> Result<(), String> {
        let mut data = self.data.write().await;
        if let Some(prefix) = prefix {
            data.retain(|k, _| !k.starts_with(prefix));
        } else {
            data.clear();
        }
        Ok(())
    }
}
