// Security module for OrchFlow
//
// Provides comprehensive security mechanisms for terminal operations,
// plugin management, and workspace trust.

pub mod terminal_security;

pub use terminal_security::{
    TerminalSecurityManager,
    SecurityContext,
    SecurityTier,
    CommandCheckResult,
    CommandSecurityPolicy,
    ProcessIsolationConfig,
    WorkspaceTrustConfig,
    AuditConfig,
    AuditEvent,
    SecurityWarning,
};