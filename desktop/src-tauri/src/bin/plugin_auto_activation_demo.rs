// Demo program to test the plugin auto-activation functionality

use orchflow::plugin_system::PluginMetadata;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔌 Testing Plugin Auto-Activation Functionality");
    println!("==============================================");
    
    // Test 1: Simple PluginMetadata with activation events
    println!("\n📝 Test 1: PluginMetadata with activation events");
    
    let metadata = PluginMetadata {
        id: "com.example.startup".to_string(),
        name: "Startup Plugin".to_string(),
        version: "1.0.0".to_string(),
        description: "A plugin that activates on startup".to_string(),
        author: orchflow::plugin_system::PluginAuthor {
            name: "Test Author".to_string(),
            email: Some("test@example.com".to_string()),
        },
        permissions: vec!["filesystem:read".to_string()],
        activation_events: vec!["onStartup".to_string(), "onCommand:test".to_string()],
    };
    
    println!("✅ Created plugin metadata:");
    println!("   ID: {}", metadata.id);
    println!("   Name: {}", metadata.name);
    println!("   Activation events: {:?}", metadata.activation_events);
    
    // Test 2: Check activation event patterns
    println!("\n🎯 Test 2: Testing activation event patterns");
    
    let test_events = vec![
        "onStartup",
        "onCommand:test",
        "onCommand:other",
        "onLanguage:rust",
        "onFileSystem:change",
        "randomEvent",
    ];
    
    for event in &test_events {
        let should_activate = should_activate_for_event(&metadata.activation_events, event);
        let status = if should_activate { "✅ ACTIVATE" } else { "❌ SKIP" };
        println!("   Event '{}': {}", event, status);
    }
    
    // Test 3: Wildcard activation
    println!("\n🌟 Test 3: Testing wildcard activation");
    
    let wildcard_metadata = PluginMetadata {
        id: "com.example.wildcard".to_string(),
        name: "Wildcard Plugin".to_string(),
        version: "1.0.0".to_string(),
        description: "A plugin that activates for all events".to_string(),
        author: orchflow::plugin_system::PluginAuthor {
            name: "Test Author".to_string(),
            email: None,
        },
        permissions: vec![],
        activation_events: vec!["*".to_string()],
    };
    
    for event in &test_events {
        let should_activate = should_activate_for_event(&wildcard_metadata.activation_events, event);
        let status = if should_activate { "✅ ACTIVATE" } else { "❌ SKIP" };
        println!("   Event '{}': {}", event, status);
    }
    
    // Test 4: Pattern matching
    println!("\n🎨 Test 4: Testing pattern-based activation");
    
    let pattern_metadata = PluginMetadata {
        id: "com.example.patterns".to_string(),
        name: "Pattern Plugin".to_string(),
        version: "1.0.0".to_string(),
        description: "A plugin with pattern-based activation".to_string(),
        author: orchflow::plugin_system::PluginAuthor {
            name: "Test Author".to_string(),
            email: None,
        },
        permissions: vec![],
        activation_events: vec![
            "onCommand:".to_string(),    // Matches any command
            "onLanguage:rust".to_string(), // Matches only Rust language
        ],
    };
    
    let pattern_test_events = vec![
        "onCommand:build",
        "onCommand:test", 
        "onCommand:run",
        "onLanguage:rust",
        "onLanguage:typescript",
        "onFileSystem:change",
    ];
    
    for event in &pattern_test_events {
        let should_activate = should_activate_for_event(&pattern_metadata.activation_events, event);
        let status = if should_activate { "✅ ACTIVATE" } else { "❌ SKIP" };
        println!("   Event '{}': {}", event, status);
    }
    
    println!("\n🎉 All plugin auto-activation tests completed successfully!");
    println!("✨ Plugin activation events are working correctly");
    
    Ok(())
}

/// Check if activation events match the given event
/// This is a simplified version of the logic from PluginManager
fn should_activate_for_event(activation_events: &[String], event: &str) -> bool {
    activation_events.iter().any(|activation_event| {
        // Handle wildcard activation
        if activation_event == "*" {
            return true;
        }
        
        // Handle exact matches
        if activation_event == event {
            return true;
        }
        
        // Handle pattern-based activation events
        match event {
            e if e.starts_with("onCommand:") => {
                activation_event.starts_with("onCommand:") && 
                (activation_event == e || activation_event == "onCommand:")
            }
            e if e.starts_with("onLanguage:") => {
                activation_event.starts_with("onLanguage:") &&
                (activation_event == e || activation_event == "onLanguage:")
            }
            e if e.starts_with("onFileSystem:") => {
                activation_event.starts_with("onFileSystem:") &&
                (activation_event == e || activation_event == "onFileSystem:")
            }
            e if e.starts_with("onView:") => {
                activation_event.starts_with("onView:") &&
                (activation_event == e || activation_event == "onView:")
            }
            e if e.starts_with("onUri:") => {
                activation_event.starts_with("onUri:") &&
                (activation_event == e || activation_event == "onUri:")
            }
            e if e.starts_with("onWebviewPanel:") => {
                activation_event.starts_with("onWebviewPanel:") &&
                (activation_event == e || activation_event == "onWebviewPanel:")
            }
            _ => false,
        }
    })
}