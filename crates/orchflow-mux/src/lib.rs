//! OrchFlow Mux - Universal terminal multiplexer abstraction layer
//!
//! This crate provides a trait-based abstraction over terminal multiplexers
//! like tmux, allowing OrchFlow to work with different backend implementations.

pub mod backend;
pub mod factory;
pub mod muxd_backend;
pub mod tmux_backend;

#[cfg(test)]
pub mod mock_backend;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod integration_tests;

#[cfg(test)]
mod mock_tests;

#[cfg(test)]
mod tmux_integration_tests;

#[cfg(test)]
mod benchmarks;

pub use backend::{MuxBackend, MuxError, MuxUIEvent, Pane, PaneSize, Session, SplitType};
pub use factory::create_mux_backend;

#[cfg(test)]
pub use mock_backend::MockBackend;
