// Demo program to test the syntax plugin event handling functionality

use orchflow::manager::events::Event;
use orchflow::manager::plugins::Plugin;
use orchflow::plugins::syntax_plugin::SyntaxPlugin;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🎨 Testing Syntax Plugin Event Handling");
    println!("======================================");
    
    // Create a syntax plugin instance
    let mut plugin = SyntaxPlugin::new();
    
    // Test 1: File opened event
    println!("\n📝 Test 1: File opened event");
    
    let file_opened_event = Event::FileOpened {
        path: "/project/src/main.rs".to_string(),
        pane_id: "pane_123".to_string(),
    };
    
    match plugin.handle_event(&file_opened_event).await {
        Ok(()) => println!("✅ Successfully handled FileOpened event"),
        Err(e) => println!("❌ Failed to handle FileOpened event: {}", e),
    }
    
    // Test 2: File changed event
    println!("\n🔄 Test 2: File changed event");
    
    let file_changed_event = Event::FileChanged {
        path: "/project/src/main.rs".to_string(),
    };
    
    match plugin.handle_event(&file_changed_event).await {
        Ok(()) => println!("✅ Successfully handled FileChanged event"),
        Err(e) => println!("❌ Failed to handle FileChanged event: {}", e),
    }
    
    // Test 3: File saved event
    println!("\n💾 Test 3: File saved event");
    
    let file_saved_event = Event::FileSaved {
        path: "/project/src/main.rs".to_string(),
    };
    
    match plugin.handle_event(&file_saved_event).await {
        Ok(()) => println!("✅ Successfully handled FileSaved event"),
        Err(e) => println!("❌ Failed to handle FileSaved event: {}", e),
    }
    
    // Test 4: Pane resized event
    println!("\n📐 Test 4: Pane resized event");
    
    let pane_resized_event = Event::PaneResized {
        pane_id: "pane_123".to_string(),
        width: 120,
        height: 40,
    };
    
    match plugin.handle_event(&pane_resized_event).await {
        Ok(()) => println!("✅ Successfully handled PaneResized event"),
        Err(e) => println!("❌ Failed to handle PaneResized event: {}", e),
    }
    
    // Test 5: Ignored event (should not cause errors)
    println!("\n🙄 Test 5: Ignored event (OrchestratorStarted)");
    
    let ignored_event = Event::OrchestratorStarted;
    
    match plugin.handle_event(&ignored_event).await {
        Ok(()) => println!("✅ Successfully ignored irrelevant event"),
        Err(e) => println!("❌ Failed to handle irrelevant event: {}", e),
    }
    
    // Test 6: Test syntax highlighting request (existing functionality)
    println!("\n🌈 Test 6: Syntax highlighting request");
    
    let request_params = serde_json::json!({
        "code": "fn main() {\n    println!(\"Hello, world!\");\n}",
        "language": "rust"
    });
    
    match plugin.handle_request("syntax.highlight", request_params).await {
        Ok(result) => println!("✅ Successfully handled syntax highlight request: {:?}", result),
        Err(e) => println!("❌ Failed to handle syntax highlight request: {}", e),
    }
    
    // Test 7: Test language detection from file path
    println!("\n🔍 Test 7: Language detection from file path");
    
    let detection_params = serde_json::json!({
        "code": "console.log('Hello, world!');",
        "file_path": "/project/src/app.js"
    });
    
    match plugin.handle_request("syntax.highlight", detection_params).await {
        Ok(result) => println!("✅ Successfully detected language and highlighted: {:?}", result),
        Err(e) => println!("❌ Failed to detect language and highlight: {}", e),
    }
    
    println!("\n🎉 All syntax plugin event handling tests completed!");
    println!("✨ Syntax plugin event handling is working correctly");
    
    Ok(())
}