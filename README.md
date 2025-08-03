# CubicAgentKit

[![npm version](https://badge.fury.io/js/@cubicler%2Fcubicagentkit.svg)](https://badge.fury.io/js/@cubicler%2Fcubicagentkit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](https://www.typescriptlang.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A modern Node.js library for creating AI agents that integrate seamlessly with **Cubicler 2.0**. Built with TypeScript, composition patterns, and dependency injection for maximum flexibility and testability.

## 🚀 Features

- **🧱 Simple & Complete**: `CubicAgent` class handles all Cubicler integration
- **🔌 Composition-Based**: Uses dependency injection for easy testing and flexibility
- **📡 Built-in HTTP Client**: `AxiosAgentClient` with middleware support for Cubicler MCP communication
- **🌐 Built-in HTTP Server**: `ExpressAgentServer` with middleware support for agent endpoints
- **🧠 Memory System**: SQLite-based persistent memory with LRU short-term caching
- **📊 Tool Call Tracking**: Automatic tracking of tool usage per request
- **🛡️ Type-Safe**: Full TypeScript support with strict typing
- **🔍 Error Transparent**: All errors thrown up to implementers for custom handling
- **⚡ Developer Experience**: Simplified `RawAgentResponse` interface (kit adds metadata)

## 📦 Installation

```bash
npm install @cubicler/cubicagentkit
```

## 🏃‍♂️ Quick Start

```typescript
import { 
  CubicAgent, 
  AxiosAgentClient, 
  ExpressAgentServer,
  createDefaultMemoryRepository,
  AgentRequest, 
  RawAgentResponse 
} from '@cubicler/cubicagentkit';

// Create client, server, and memory system
const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const memory = await createDefaultMemoryRepository(); // SQLite in-memory
const cubicAgent = new CubicAgent(client, server, memory);

// Start server with dispatch handler
try {
  await cubicAgent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    
    // Use memory system
    if (lastMessage.content?.includes('remember')) {
      const memoryId = await context.memory?.remember(
        'User likes detailed explanations', 
        0.8, 
        ['preference', 'communication']
      );
      return {
        type: 'text',
        content: `I'll remember that! (Memory ID: ${memoryId})`,
        usedToken: 30
      };
    }
    
    // Search memories for context
    const memories = await context.memory?.search({ 
      tags: ['preference'], 
      limit: 3 
    });
    
    // Call Cubicler tools if needed
    if (lastMessage.content?.includes('weather')) {
      const weatherData = await client.callTool('weatherService_getCurrentWeather', {
        city: 'Paris'
      });
      
      return {
        type: 'text',
        content: `The weather is ${weatherData.temperature}°C (used ${context.toolCallCount} tools)`,
        usedToken: 50
      };
    }
    
    return {
      type: 'text',
      content: `Hello! You said: ${lastMessage.content}`,
      usedToken: 25
    };
  });
  
  console.log('✅ Agent started on http://localhost:3000/agent');
} catch (error) {
  console.error('❌ Failed to start agent:', error);
  process.exit(1);
}
```

## 🏗️ Architecture

CubicAgentKit follows a **composition-based architecture** with clean separation of concerns:

```mermaid
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   CubicAgent    │────│  AgentClient     │────│ AxiosAgentClient │
│   (Orchestrator)│    │  (Interface)     │    │ (HTTP Client)    │
└─────────────────┘    └──────────────────┘    └──────────────────┘
         │
         │              ┌──────────────────┐    ┌──────────────────┐
         ├──────────────│  AgentServer     │────│ExpressAgentServer│
         │              │  (Interface)     │    │ (HTTP Server)    │
         │              └──────────────────┘    └──────────────────┘
         │
         |              ┌──────────────────┐    ┌──────────────────┐
         └──────────────│ MemoryRepository │────│ SQLiteMemory +   │
                        │  (Interface)     │    │ LRUShortTerm     │
                        └──────────────────┘    └──────────────────┘
```

### Core Components

- **`CubicAgent`**: Main orchestrator handling server lifecycle, request routing, and memory integration
- **`AxiosAgentClient`**: HTTP client implementing Cubicler's MCP protocol  
- **`ExpressAgentServer`**: HTTP server handling agent endpoint requests
- **`TrackingAgentClient`**: Wrapper providing automatic tool call counting
- **`AgentMemoryRepository`**: Two-tier memory system with persistent storage and LRU cache
- **`SQLiteMemory`**: Production-ready persistent storage with full-text search
- **`LRUShortTermMemory`**: Token-based LRU cache for frequently accessed memories

## 📝 API Reference

### CubicAgent

Main class for creating and managing Cubicler agents with optional memory integration.

```typescript
class CubicAgent {
  constructor(
    agentClient: AgentClient, 
    server: AgentServer, 
    memory?: MemoryRepository
  )
  
  async start(handler: DispatchHandler): Promise<void>
  async stop(): Promise<void>
}

type DispatchHandler = (
  request: AgentRequest,
  client: AgentClient,
  context: CallContext
) => Promise<RawAgentResponse>

interface CallContext {
  readonly toolCallCount: number;
  memory?: MemoryRepository;
}
```

### Memory System

Sentence-based memory system with SQLite persistence and LRU caching.

```typescript
// Factory functions for easy setup
async function createDefaultMemoryRepository(
  maxTokens?: number,
  defaultImportance?: number
): Promise<AgentMemoryRepository>

async function createSQLiteMemoryRepository(
  dbPath: string,
  maxTokens?: number,
  defaultImportance?: number
): Promise<AgentMemoryRepository>

// Core memory operations
interface MemoryRepository {
  remember(sentence: string, importance?: number, tags: string[]): Promise<string>
  recall(id: string): Promise<AgentMemory | null>
  search(options: MemorySearchOptions): Promise<AgentMemory[]>
  editImportance(id: string, importance: number): Promise<boolean>
  editContent(id: string, sentence: string): Promise<boolean>
  addTag(id: string, tag: string): Promise<boolean>
  removeTag(id: string, tag: string): Promise<boolean>
  forget(id: string): Promise<boolean>
  getStats(): Promise<MemoryStats>
}
```

### AxiosAgentClient

HTTP client for Cubicler MCP communication with middleware support.

```typescript
class AxiosAgentClient implements AgentClient {
  constructor(url: string, timeout?: number)
  
  useMiddleware(middleware: RequestMiddleware): this
  async initialize(): Promise<void>
  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>
}
```

### ExpressAgentServer

Express-based HTTP server with middleware support.

```typescript
class ExpressAgentServer implements AgentServer {
  constructor(port: number, endpoint?: string)
  
  useMiddleware(middleware: ExpressMiddleware): this
  async start(handler: RequestHandler): Promise<void>
  async stop(): Promise<void>
}
```

## 🔧 Advanced Usage

### Memory System Usage

The memory system provides persistent storage for agent context and user preferences:

```typescript
import { createSQLiteMemoryRepository } from '@cubicler/cubicagentkit';

// Create production memory with file-based SQLite
const memory = await createSQLiteMemoryRepository('./agent-memories.db', 2000, 0.7);

const cubicAgent = new CubicAgent(client, server, memory);

await cubicAgent.start(async (request, client, context) => {
  const lastMessage = request.messages[request.messages.length - 1];
  
  // Store important information
  if (lastMessage.content?.includes('I prefer')) {
    const memoryId = await context.memory?.remember(
      lastMessage.content,
      0.9, // High importance for preferences
      ['user_preference', 'communication']
    );
  }
  
  // Search for relevant context
  const relevantMemories = await context.memory?.search({
    content: 'prefer',
    tags: ['user_preference'],
    sortBy: 'importance',
    limit: 5
  });
  
  // Use memories to personalize response
  let response = "Hello!";
  if (relevantMemories && relevantMemories.length > 0) {
    response = `Hello! I remember you prefer ${relevantMemories[0].sentence}`;
  }
  
  return {
    type: 'text',
    content: response,
    usedToken: 30
  };
});
```

### Memory Search Options

```typescript
interface MemorySearchOptions {
  content?: string;        // Text search in sentences
  contentRegex?: string;   // Regex pattern for content
  tags?: string[];         // Must have ALL these tags
  tagsRegex?: string;      // Regex pattern for tags
  sortBy?: 'importance' | 'timestamp' | 'both';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

// Example searches
const recentMemories = await memory.search({
  sortBy: 'timestamp',
  sortOrder: 'desc',
  limit: 10
});

const importantPreferences = await memory.search({
  tags: ['preference'],
  sortBy: 'importance',
  sortOrder: 'desc'
});

const weatherRelated = await memory.search({
  contentRegex: 'weather|temperature|forecast',
  limit: 5
});
```

### Custom Memory Implementations

Create custom storage backends by implementing the interfaces:

```typescript
import { PersistentMemory, ShortTermMemory } from '@cubicler/cubicagentkit';

class RedisMemory implements PersistentMemory {
  async initialize(): Promise<void> {
    // Connect to Redis
  }
  
  async store(memory: MemoryItem): Promise<void> {
    // Store in Redis with JSON serialization
  }
  
  // ... implement all required methods
}

class CustomLRUCache implements ShortTermMemory {
  async get(id: string): Promise<AgentMemory | null> {
    // Custom cache implementation
  }
  
  // ... implement all required methods
}

// Use custom implementations
const customMemory = new AgentMemoryRepository(
  new RedisMemory(),
  new CustomLRUCache(),
  { defaultImportance: 0.6 }
);
```

### With Middleware

Add authentication, CORS, logging, and other middleware:

```typescript
// Client middleware for authentication
const client = new AxiosAgentClient('http://localhost:1503')
  .useMiddleware((config) => {
    config.headers.Authorization = `Bearer ${process.env.CUBICLER_TOKEN}`;
    return config;
  });

// Server middleware for CORS
const server = new ExpressAgentServer(3000, '/agent')
  .useMiddleware((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

const cubicAgent = new CubicAgent(client, server);
```

### Tool Call Examples

Access Cubicler's internal tools and MCP servers:

```typescript
await cubicAgent.start(async (request, client, context) => {
  // Get available servers (new structured format in Cubicler 2.3.0)
  const serverList = await client.callTool('cubicler_available_servers', {});
  // Returns: { "total": 1, "servers": [{"identifier": "...", "name": "...", ...}] }
  
  // Fetch tools from a specific server (now working in Cubicler 2.3.0!)
  const tools = await client.callTool('cubicler_fetch_server_tools', { 
    serverIdentifier: 'weatherService' 
  });
  
  // Call tools from MCP servers
  const weather = await client.callTool('weatherService_getCurrentWeather', {
    city: 'Paris',
    country: 'France'
  });
  
  // Access tool call count and memory
  console.log(`Used ${context.toolCallCount} tools in this request`);
  
  // Store the interaction in memory
  if (context.memory) {
    await context.memory.remember(
      `User asked about weather in Paris, temperature was ${weather.temperature}°C`,
      0.6,
      ['weather', 'interaction', 'paris']
    );
  }
  
  return {
    type: 'text',
    content: `Weather: ${weather.temperature}°C`,
    usedToken: 100
  };
});
```

### Custom Implementations

Create custom clients and servers by implementing the interfaces:

```typescript
import { AgentClient, AgentServer } from '@cubicler/cubicagentkit';

class CustomMQTTClient implements AgentClient {
  async initialize(): Promise<void> {
    // Custom MQTT initialization
  }
  
  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    // Custom tool calling via MQTT
  }
}

class CustomFastifyServer implements AgentServer {
  async start(handler: RequestHandler): Promise<void> {
    // Custom Fastify server setup
  }
  
  async stop(): Promise<void> {
    // Custom server shutdown
  }
}

const customAgent = new CubicAgent(
  new CustomMQTTClient(),
  new CustomFastifyServer()
);
```

## 📊 Type Definitions

### Request & Response Types

```typescript
// What your handler receives
interface AgentRequest {
  agent: {
    identifier: string;
    name: string;
    description: string;
    prompt: string;
  };
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

// What the kit sends to Cubicler (complete)
interface AgentResponse {
  timestamp: string; // Added by kit
  type: 'text' | 'null';
  content: string | null;
  metadata: {
    usedToken: number; // From your handler
    usedTools: number; // Added by kit from tracking
  };
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

Use provided mocks for testing your agents:

```typescript
import { MockAgentClient, MockAgentServer } from '@cubicler/cubicagentkit/tests/mocks';

// Test your dispatch handler
const mockClient = new MockAgentClient();
const mockServer = new MockAgentServer();
const testAgent = new CubicAgent(mockClient, mockServer);

mockClient.mockToolCall('weatherService_getWeather', { temperature: '22°C' });

// Test your handler logic
```

## 🔨 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

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

- **Documentation**: [GitHub Wiki](https://github.com/Cubicler/CubicAgentKit/wiki)
- **Issues**: [GitHub Issues](https://github.com/Cubicler/CubicAgentKit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Cubicler/CubicAgentKit/discussions)

---

Built with ❤️ for the **Cubicler** ecosystem.

- **MCP Protocol**: Built-in utilities for calling Cubicler's MCP endpoint

## Documentation

See the [API Documentation](./docs/api.md) for detailed usage information.

## License

MIT
