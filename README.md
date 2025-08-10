# CubicAgentKit

[![npm version](https://badge.fury.io/js/@cubicler%2Fcubicagentkit.svg)](https://badge.fury.io/js/@cubicler%2Fcubicagentkit)
[!## 🎯 Recent Updates

**v2.6.0** - Major Architecture Improvements:

- **🔄 JSON-RPC 2.0 Protocol**: Stdio transport now uses standard JSON-RPC 2.0 for all communication
- **📁 Unified Models**: Consolidated agent request/response types into single `agent.ts` model file
- **📝 Logger Infrastructure**: Added comprehensive logging system with transport-specific behavior
- **🏗️ Builder Pattern**: Enhanced fluent API for agent configuration with `start().onMessage().onTrigger().listen()`
- **🛡️ Type Safety**: Improved TypeScript support with stricter typing and better error handling

All changes maintain full backward compatibility while improving code organization and protocol standardization.

## 🏗️ Architecturehttps://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](<https://www.typescriptlang.org/>)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A modern Node.js library for creating AI agents that integrate seamlessly with **Cubicler 2.6**. Built with TypeScript, composition patterns, and dependency injection for maximum flexibility and testability.

## 🚀 Features

- **🧱 Simple & Complete**: `CubicAgent` class handles all Cubicler integration
- **🔌 Composition-Based**: Uses dependency injection for easy testing and flexibility
- **📡 Multiple Transports**: HTTP, SSE (Server-Sent Events), and Stdio support
- **🔐 JWT Authentication**: Complete JWT support with static tokens and OAuth 2.0 flows
- **🧠 Memory System**: SQLite-based persistent memory with LRU short-term caching
- **📊 Tool Call Tracking**: Automatic tracking of tool usage per request
- **🛡️ Type-Safe**: Full TypeScript support with strict typing and consolidated model architecture
- **📝 Smart Logging**: Transport-specific logging system (silent for stdio, console for HTTP/SSE)
- **🔍 Error Transparent**: All errors thrown up to implementers for custom handling

## 📦 Installation

```bash
npm install @cubicler/cubicagentkit
```

## 🏃‍♂️ Quick Start

Choose your preferred transport method:

### HTTP Agent (Traditional Server)

```typescript
import { CubicAgent, HttpAgentClient, HttpAgentServer, MessageHandler } from '@cubicler/cubicagentkit';

const client = new HttpAgentClient('http://localhost:1503');
const server = new HttpAgentServer(3000, '/agent');
const agent = new CubicAgent(client, server);

const messageHandler: MessageHandler = async (request, client, context) => {
  const lastMessage = request.messages[request.messages.length - 1];
  return {
    type: 'text',
    content: `Hello! You said: ${lastMessage.content}`,
    usedToken: 25
  };
};

await agent.start()
  .onMessage(messageHandler)
  .listen();

console.log('✅ Agent running on http://localhost:3000/agent');
```

### SSE Agent (Real-time)

```typescript
import { CubicAgent, HttpAgentClient, SSEAgentServer, MessageHandler } from '@cubicler/cubicagentkit';

const client = new HttpAgentClient('http://localhost:1503');
const server = new SSEAgentServer('http://localhost:8080', 'my-agent-id');
const agent = new CubicAgent(client, server);

const messageHandler: MessageHandler = async (request, client, context) => {
  // Same handler logic as HTTP version
  return { type: 'text', content: 'Hello from SSE!', usedToken: 15 };
};

await agent.start()
  .onMessage(messageHandler)
  .listen();

console.log('⚡ SSE Agent connected to Cubicler');
```

### Stdio Agent (CLI/Subprocess)

For agents that run as subprocesses spawned by Cubicler:

```typescript
#!/usr/bin/env node
import { CubicAgent, StdioAgentClient, StdioAgentServer, MessageHandler } from '@cubicler/cubicagentkit';

// Stdio agent is spawned by Cubicler, not the other way around
const client = new StdioAgentClient();
const server = new StdioAgentServer();
const agent = new CubicAgent(client, server);

const messageHandler: MessageHandler = async (request, client, context) => {
  const lastMessage = request.messages[request.messages.length - 1];
  
  // Make MCP calls back to Cubicler using JSON-RPC 2.0
  const weather = await client.callTool('weather_get_current', { city: 'Paris' });
  
  return {
    type: 'text',
    content: `Weather: ${weather.temperature}°C`,
    usedToken: 30
  };
};

await agent.start()
  .onMessage(messageHandler)
  .onTrigger(async (request) => ({
    type: 'text',
    content: `Webhook: ${request.trigger.name}`,
    usedToken: 15
  }))
  .listen();

console.error('Stdio Agent ready'); // Use stderr for logging
```

**⚠️ Important: NPX Execution Fix**

When using stdio agents that can be executed via `npx`, ensure proper main module detection by checking both the standard import.meta.url comparison and the process arguments for your package name:

```typescript
// Only run if this is the main module (handle both direct execution and npx)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.includes('your-package-name');
if (isMainModule) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
```

This prevents the common issue where stdio agents fail to start when executed via `npx` because `process.argv[1]` points to the npx wrapper instead of the actual module file.

Configure in Cubicler's `agents.json`:

```json
{
  "agents": {
    "my_stdio_agent": {
      "name": "My Stdio Agent",
      "transport": "stdio",
      "command": "/path/to/my-agent.js",
      "description": "A stdio-based agent"
    }
  }
}
```

## 📚 Documentation

### Transport Guides

- **[HTTP Agent](docs/HTTP_AGENT.md)** - Traditional server deployment with HTTP endpoints
- **[SSE Agent](docs/SSE_AGENT.md)** - Real-time communication via Server-Sent Events  
- **[Stdio Agent](docs/STDIO_AGENT.md)** - Command-line and subprocess integration with JSON-RPC 2.0 protocol

### Feature Guides

- **[JWT Authentication](docs/JWT_AUTH.md)** - Comprehensive authentication with static tokens and OAuth 2.0
- Security note: the built-in server JWT verifier is development‑oriented and does not verify signatures. For production, use a `jsonwebtoken`/JWKS middleware as shown in docs/JWT_AUTH.md.
- **[Memory System](docs/MEMORY_SYSTEM.md)** - Persistent memory with SQLite and LRU caching
- **[Webhook Implementation](AGENT_WEBHOOK_IMPLEMENTATION.md)** - Complete guide for handling webhook triggers alongside user messages

## � Recent Updates

**v2.6.0** - Major Architecture Improvements:

- **🔄 JSON-RPC 2.0 Protocol**: Stdio transport now uses standard JSON-RPC 2.0 for all communication
- **📁 Unified Models**: Consolidated agent request/response types into single `agent.ts` model file
- **📝 Logger Infrastructure**: Added comprehensive logging system with transport-specific behavior
- **�🏗️ Builder Pattern**: Enhanced fluent API for agent configuration with `start().onMessage().onTrigger().listen()`
- **🛡️ Type Safety**: Improved TypeScript support with stricter typing and better error handling

All changes maintain full backward compatibility while improving code organization and protocol standardization.

CubicAgentKit follows a **composition-based architecture** with clean separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   CubicAgent    │────│  AgentClient     │────│ HttpAgentClient  │
│   (Orchestrator)│    │  (Interface)     │    │ (HTTP Client)    │
└─────────────────┘    └──────────────────┘    └──────────────────┘
         │                                               │
         │              ┌──────────────────┐    ┌──────────────────┐
         ├──────────────│  AgentServer     │    │ StdioAgentClient │
         │              │  (Interface)     │    │ (CLI Client)     │
         │              └──────────────────┘    └──────────────────┘
         │                        │
         │              ┌──────────────────┐
         │              │ HttpAgentServer  │
         │              │ (HTTP Server)    │
         │              └──────────────────┘
         │                        │
         │              ┌──────────────────┐
         │              │ SSEAgentServer   │
         │              │ (SSE Client)     │
         │              └──────────────────┘
         │                        │
         │              ┌──────────────────┐
         │              │ StdioAgentServer │
         │              │ (CLI Server)     │
         │              └──────────────────┘
         │
         │              ┌──────────────────┐    ┌──────────────────┐
         └──────────────│ MemoryRepository │────│ SQLiteMemory +   │
                        │  (Interface)     │    │ LRUShortTerm     │
                        └──────────────────┘    └──────────────────┘
```

### Core Components

- **`CubicAgent`**: Main orchestrator handling server lifecycle, request routing, and memory integration
- **`HttpAgentClient`**: HTTP client implementing Cubicler's MCP protocol  
- **`StdioAgentClient`**: Stdio client for CLI-based MCP communication using JSON-RPC 2.0
- **`HttpAgentServer`**: HTTP server handling agent endpoint requests
- **`StdioAgentServer`**: Stdio server for CLI-based agent communication using JSON-RPC 2.0
- **`SSEAgentServer`**: SSE client for real-time communication with Cubicler
- **`AgentMemoryRepository`**: Two-tier memory system with persistent storage and LRU cache

## 📝 API Reference

### CubicAgent

Main class for creating and managing Cubicler agents. Uses a fluent builder to register handlers.

```typescript
class CubicAgent {
  constructor(
    agentClient: AgentClient,
    server: AgentServer,
    memory?: MemoryRepository
  ) {}

  // Begin fluent configuration
  start(): AgentBuilder;

  // Stop the server
  async stop(): Promise<void>;

  // Manually dispatch a request using configured handlers
  async dispatch(request: AgentRequest): Promise<AgentResponse>;
}

interface AgentBuilder {
  onMessage(handler: MessageHandler): AgentBuilder;
  onTrigger(handler: TriggerHandler): AgentBuilder;
  listen(): Promise<void>;
}

interface CallContext {
  readonly toolCallCount: number; // tool calls in this request
  readonly memory?: MemoryRepository; // optional repository from constructor
}
```

### Memory System

Create memory repositories with factory functions:

```typescript
// In-memory SQLite (development)
const memory = await createDefaultMemoryRepository();

// File-based SQLite (production)
const memory = await createSQLiteMemoryRepository('./memories.db');

// Custom setup
const memory = await createMemoryRepository(longTermStorage, 2000, 0.7);
```

### Trigger Handling

Register a webhook trigger handler with the builder. When Cubicler invokes a trigger, your handler receives a `TriggerRequest`:

```typescript
import { CubicAgent, HttpAgentClient, HttpAgentServer, TriggerHandler } from '@cubicler/cubicagentkit';

const agent = new CubicAgent(
  new HttpAgentClient('http://localhost:1503'),
  new HttpAgentServer(3000, '/agent')
);

const onTrigger: TriggerHandler = async (request, client, ctx) => {
  // request.trigger contains identifier and payload
  return { type: 'text', content: `Triggered: ${request.trigger.identifier}` , usedToken: 5 };
};

await agent.start().onTrigger(onTrigger).listen();
```

### Request & Response Types

```typescript
// What your handler receives
interface AgentRequest {
  agent: { identifier: string; name: string; description: string; prompt: string; };
  tools: AgentTool[];
  servers: ServerInfo[];
  messages: Message[];
}

// What your handler returns (simplified)
interface RawAgentResponse {
  type: 'text' | 'null';
  content: string | null;
  usedToken: number;
}
```

## 🧪 Testing

The library is thoroughly tested with 25+ unit tests. Run tests with:

```bash
npm test          # Run in watch mode
npm run test:run  # Run once
npm run test:ui   # Run with UI
```

### Mock Implementations

```typescript
import { MockAgentClient, MockAgentServer } from '@cubicler/cubicagentkit/tests/mocks';

const mockClient = new MockAgentClient();
const mockServer = new MockAgentServer();
const testAgent = new CubicAgent(mockClient, mockServer);

mockClient.mockToolCall('weatherService_getWeather', { temperature: '22°C' });
```

## 🔨 Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Lint code
npm run lint

# Run full check (lint + test + build)
npm run check
```

## 📄 License

Apache 2.0 License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📞 Support

- **Documentation**: [Transport Guides](docs/) and [Feature Guides](docs/)
- **Issues**: [GitHub Issues](https://github.com/Cubicler/CubicAgentKit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Cubicler/CubicAgentKit/discussions)

---

Built with ❤️ for the **Cubicler** ecosystem.
