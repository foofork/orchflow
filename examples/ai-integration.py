#!/usr/bin/env python3
"""
Example: Third-party AI integration with Orchflow

This shows how an AI agent can control Orchflow to:
1. Run tests and analyze failures
2. Open relevant files
3. Make code changes
4. Re-run tests
"""

import json
import asyncio
import websockets
from typing import Dict, Any, List, Optional

class OrchflowClient:
    """Simple client for connecting to Orchflow orchestrator"""
    
    def __init__(self, url: str = "ws://localhost:7777"):
        self.url = url
        self.ws = None
        self.request_id = 0
        self.pending_requests = {}
        self.event_handlers = {}
        
    async def connect(self):
        """Connect to Orchflow"""
        self.ws = await websockets.connect(self.url)
        # Start listening for events
        asyncio.create_task(self._listen())
        
    async def _listen(self):
        """Listen for events from Orchflow"""
        async for message in self.ws:
            data = json.loads(message)
            
            # Handle responses to our requests
            if "id" in data:
                request_id = data["id"]
                if request_id in self.pending_requests:
                    self.pending_requests[request_id].set_result(data)
                    
            # Handle events
            elif "event" in data:
                event_type = data["event"]["type"]
                if event_type in self.event_handlers:
                    for handler in self.event_handlers[event_type]:
                        asyncio.create_task(handler(data["event"]))
    
    async def execute(self, action: Dict[str, Any]) -> Any:
        """Execute an action in Orchflow"""
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "method": "execute",
            "params": {"action": action},
            "id": self.request_id
        }
        
        # Create future for response
        future = asyncio.Future()
        self.pending_requests[self.request_id] = future
        
        # Send request
        await self.ws.send(json.dumps(request))
        
        # Wait for response
        response = await future
        
        if "error" in response:
            raise Exception(response["error"])
            
        return response.get("result")
    
    def on_event(self, event_type: str):
        """Decorator to register event handlers"""
        def decorator(func):
            if event_type not in self.event_handlers:
                self.event_handlers[event_type] = []
            self.event_handlers[event_type].append(func)
            return func
        return decorator
    
    async def subscribe(self, events: List[str]):
        """Subscribe to specific events"""
        request = {
            "jsonrpc": "2.0",
            "method": "subscribe",
            "params": {"events": events}
        }
        await self.ws.send(json.dumps(request))

class TestDrivenAI:
    """Example AI that does test-driven development"""
    
    def __init__(self):
        self.client = OrchflowClient()
        self.test_pane_id = None
        self.editor_pane_id = None
        self.current_session_id = None
        
    async def setup(self):
        """Connect and set up the development environment"""
        await self.client.connect()
        
        # Subscribe to relevant events
        await self.client.subscribe([
            "pane_output",
            "command_completed",
            "file_opened",
            "file_saved"
        ])
        
        # Register event handlers
        self.client.on_event("pane_output")(self.handle_pane_output)
        self.client.on_event("command_completed")(self.handle_command_completed)
        
        # Create a new session
        result = await self.client.execute({
            "type": "create_session",
            "name": "AI Development Session"
        })
        self.current_session_id = result["id"]
        
        # Create panes for testing and editing
        test_pane = await self.client.execute({
            "type": "create_pane",
            "session_id": self.current_session_id,
            "pane_type": "terminal",
            "command": None
        })
        self.test_pane_id = test_pane["id"]
        
        editor_pane = await self.client.execute({
            "type": "create_pane",
            "session_id": self.current_session_id,
            "pane_type": "editor",
            "command": None
        })
        self.editor_pane_id = editor_pane["id"]
        
    async def run_tests(self):
        """Run the test suite"""
        print("🧪 Running tests...")
        await self.client.execute({
            "type": "run_command",
            "pane_id": self.test_pane_id,
            "command": "npm test"
        })
        
    async def handle_pane_output(self, event: Dict[str, Any]):
        """Handle output from panes"""
        if event["pane_id"] == self.test_pane_id:
            output = event["data"]
            
            # Look for test failures
            if "FAIL" in output or "✗" in output:
                print(f"❌ Test failure detected: {output}")
                
                # Extract failing file (simplified example)
                if "Error: " in output:
                    # Try to find file path in error
                    lines = output.split('\n')
                    for line in lines:
                        if ".js:" in line or ".ts:" in line:
                            # Extract file path
                            parts = line.split(':')
                            if len(parts) > 0:
                                file_path = parts[0].strip()
                                await self.open_and_fix_file(file_path)
                                break
                                
    async def handle_command_completed(self, event: Dict[str, Any]):
        """Handle command completion"""
        if event["pane_id"] == self.test_pane_id:
            if event["exit_code"] == 0:
                print("✅ All tests passed!")
            else:
                print(f"❌ Tests failed with exit code: {event['exit_code']}")
                
    async def open_and_fix_file(self, file_path: str):
        """Open a file and attempt to fix it"""
        print(f"📝 Opening file: {file_path}")
        
        # Open the file
        await self.client.execute({
            "type": "open_file",
            "path": file_path,
            "pane_id": self.editor_pane_id
        })
        
        # Get the file content (in a real implementation)
        # For now, just simulate a fix
        await asyncio.sleep(1)
        
        print(f"🔧 Attempting to fix: {file_path}")
        
        # Make a simple fix (example)
        fixed_content = "// Fixed by AI\n" + "export function fixedFunction() { return true; }"
        
        await self.client.execute({
            "type": "save_file",
            "path": file_path,
            "content": fixed_content
        })
        
        print(f"💾 Saved fix to: {file_path}")
        
        # Re-run tests
        await self.run_tests()
        
    async def develop_feature(self, feature_description: str):
        """Main AI loop for developing a feature"""
        print(f"🚀 Starting development of: {feature_description}")
        
        # Initial test run to see current state
        await self.run_tests()
        
        # Wait for tests to complete and react to failures
        # In a real implementation, this would be more sophisticated
        await asyncio.sleep(30)
        
        print("🎉 Development session complete!")

async def main():
    """Example usage of the AI integration"""
    ai = TestDrivenAI()
    
    try:
        # Set up the environment
        await ai.setup()
        
        # Develop a feature
        await ai.develop_feature("Add user authentication")
        
        # Keep running to handle events
        await asyncio.sleep(60)
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if ai.client.ws:
            await ai.client.ws.close()

if __name__ == "__main__":
    asyncio.run(main())