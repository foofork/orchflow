pub mod plugin;
pub mod manager;
pub mod api;
pub mod manifest;
pub mod loader;
pub mod sandbox;

pub use plugin::{Plugin, PluginMetadata, PluginState};
pub use manager::PluginManager;
pub use api::{PluginApi, PluginContext};
pub use manifest::{PluginManifest, PluginPermission};
pub use loader::PluginLoader;