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
  AgentRequest, 
  RawAgentResponse 
} from '@cubicler/cubicagentkit';

// Create client and server with built-in implementations
const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const cubicAgent = new CubicAgent(client, server);

// Start server with dispatch handler
try {
  await cubicAgent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    
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
         └──────────────│  AgentServer     │────│ExpressAgentServer│
                        │  (Interface)     │    │ (HTTP Server)    │
                        └──────────────────┘    └──────────────────┘
```

### Core Components

- **`CubicAgent`**: Main orchestrator handling server lifecycle and request routing
- **`AxiosAgentClient`**: HTTP client implementing Cubicler's MCP protocol  
- **`ExpressAgentServer`**: HTTP server handling agent endpoint requests
- **`TrackingAgentClient`**: Wrapper providing automatic tool call counting

## 📝 API Reference

### CubicAgent

Main class for creating and managing Cubicler agents.

```typescript
class CubicAgent {
  constructor(agentClient: AgentClient, server: AgentServer)
  
  async start(handler: DispatchHandler): Promise<void>
  async stop(): Promise<void>
}

type DispatchHandler = (
  request: AgentRequest,
  client: AgentClient,
  context: CallContext
) => Promise<RawAgentResponse>
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
  // Get available servers
  const servers = await client.callTool('cubicler_availableServers', {});
  
  // Fetch tools from a specific server
  const tools = await client.callTool('cubicler_fetchServerTools', { 
    serverIdentifier: 'weatherService' 
  });
  
  // Call tools from MCP servers
  const weather = await client.callTool('weatherService_getCurrentWeather', {
    city: 'Paris',
    country: 'France'
  });
  
  // Access tool call count
  console.log(`Used ${context.toolCallCount} tools in this request`);
  
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
