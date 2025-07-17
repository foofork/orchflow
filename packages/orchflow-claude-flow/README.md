# OrchFlow

Natural language orchestration for Claude that feels like a superpower.

## What is OrchFlow?

OrchFlow injects orchestration capabilities directly into your Claude conversation. Instead of managing multiple terminal windows or copying context between sessions, you naturally orchestrate complex tasks through conversation.

## How it Works

```bash
# Install
npm install -g @orchflow/claude-flow

# Launch Claude with orchestration powers
orchflow
```

Now in your Claude conversation:

```
You: Let's build a complete authentication system with frontend, backend, and tests

Claude: I'll help you build a complete authentication system. Let me set up parallel 
        work streams for the frontend, backend, and tests so we can develop all 
        components simultaneously.

        [Creates 3 workers behind the scenes]
        
        Starting with the backend API...
        [Naturally continues the conversation while orchestrating]
```

## Key Features

### 🧠 **Intelligent Orchestration**
Claude understands when to parallelize work without being told explicitly.

### 💬 **Natural Conversation**
No special commands or syntax. Just describe what you want to build.

### 🔄 **Seamless Context Switching**
Move between different aspects of your project naturally in conversation.

### 🔗 **Automatic Knowledge Sharing**
Decisions, interfaces, and patterns are automatically shared across all work streams.

### 💾 **Session Persistence**
Save and restore entire orchestration sessions.

## Example

```
You: I need to build an e-commerce platform with product catalog, shopping cart, 
     payment processing, and admin dashboard

Claude: I'll help you build a complete e-commerce platform. This is perfect for 
        parallel development. Let me organize the work:

        ✓ Product Catalog Developer - Building product management
        ✓ Shopping Cart Engineer - Implementing cart and checkout
        ✓ Payment Integration Specialist - Setting up payment processing  
        ✓ Admin Dashboard Builder - Creating management interface

        Let's start by defining shared data models that all components will use...

You: How's the payment integration going?

Claude: [Switches context seamlessly] The payment integration is progressing well! 
        I've implemented Stripe integration with webhook handling...

You: Make sure all components use the same error handling

Claude: I'll synchronize the error handling pattern across all workers. 
        [Shares error handling code to all workers automatically]
        All components now use consistent error handling!
```

## Installation

```bash
# Requires Node.js 16+ and claude-flow
npm install -g claude-flow
npm install -g @orchflow/claude-flow

# Launch
orchflow
```

## Architecture

OrchFlow uses the Model Context Protocol (MCP) to inject orchestration tools into Claude:

- **MCP Tools**: Provide orchestration capabilities
- **System Prompt**: Teaches Claude orchestration patterns  
- **Orchestration Core**: Manages worker states and coordination
- **Seamless Integration**: Works within your normal Claude conversation

## Documentation

- [Quick Start](QUICK_START.md)
- [User Guide](USER_GUIDE.md)
- [Examples](EXAMPLES.md)
- [API Reference](API.md)

## Why OrchFlow?

Traditional development bounces between files, terminals, and contexts. OrchFlow lets you orchestrate complex development naturally through conversation, multiplying your effectiveness while maintaining quality and consistency.

## License

MIT