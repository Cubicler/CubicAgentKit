# CubicAgentKit AI Development Instructions

CubicAgentKit is an **npm library** that helps developers create AI agents for Cubicler 2.0 based on Node.js. It provides a simple, complete class-based approach using composition architecture with dependency injection for easy testing and flexibility.

## 🧱 System Overview

CubicAgentKit simplifies the creation of **CubicAgents** that integrate with Cubicler by providing:
- A complete `CubicAgent` class that handles HTTP server setup and Cubicler communication
- Built-in `AxiosAgentClient` for Cubicler MCP communication with middleware support
- Built-in `ExpressAgentServer` for HTTP server management with middleware support
- Automatic tool call tracking with `TrackingAgentClient` wrapper
- Type-safe request/response handling matching Cubicler's API contract
- Simplified developer interface with `RawAgentResponse` (kit adds timestamp and tool count)
- Error propagation to implementers for custom handling

**Architecture Philosophy:**
- **Composition over inheritance** - No abstract classes, use dependency injection
- **Simple and complete** - CubicAgent class handles all Cubicler integration
- **Error transparency** - All errors thrown up to implementers
- **Type safety** - Full TypeScript support with strict typing
- **Developer experience** - Built-in implementations with middleware support

## 🏗️ Core Architecture Principles

### Composition-Based Design
CubicAgentKit uses composition with dependency injection rather than inheritance:

```typescript
// Instead of abstract classes, we use interfaces and composition
interface AgentClient {
    initialize(): Promise<void>;
    callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>;
}

class CubicAgent {
  constructor(private agentClient: AgentClient, private config: AgentConfig) {}
  // Complete implementation, no abstract methods
}
```

### Service-Oriented Architecture
Following Cubicler's patterns with focused interfaces:

- **`AgentClient`** - Interface for Cubicler MCP communication
- **`AxiosAgentClient`** - Built-in HTTP client with middleware support
- **`AgentServer`** - Interface for HTTP server management
- **`ExpressAgentServer`** - Built-in Express server with middleware support
- **`TrackingAgentClient`** - Wrapper that automatically tracks tool calls per request

Key services instantiated with dependency injection:
```typescript
// Built-in implementations for immediate use
const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const agent = new CubicAgent(client, server);
```

### Error Handling Strategy
All errors are propagated to implementers:
```typescript
// CubicAgentKit throws errors up - implementer decides how to handle
try {
  await cubicAgent.start();
} catch (error) {
  // Implementer handles errors (logging, recovery, etc.)
  console.error('Agent startup failed:', error);
}
```

## 📦 Package Structure

```
src/
  core/
    cubic-agent.ts               # Main CubicAgent class with tool tracking
    axios-agent-client.ts        # Axios-based Cubicler client with middleware
    express-agent-server.ts      # Express-based HTTP server with middleware
    tracking-agent-client.ts     # Tool call tracking wrapper
  interface/
    agent-client.ts              # AgentClient interface
    agent-server.ts              # AgentServer interface and handler types
  model/
    agent-request.ts             # AgentRequest type (from Cubicler)
    agent-response.ts            # AgentResponse & RawAgentResponse types
    mcp-protocol.ts              # MCP JSON-RPC 2.0 protocol types
    types.ts                     # Common JSON and Cubicler types
tests/
  core/
    cubic-agent.test.ts          # CubicAgent unit tests
    tracking-agent-client.test.ts # Tool tracking tests
  mocks/
    mock-agent-client.ts         # Mock implementations for testing
    mock-agent-server.ts         # Mock server for testing
    test-helpers.ts              # Test utilities
```

## 🎯 Core Classes & Interfaces

### CubicAgent Class

The main orchestrator class that handles HTTP server and dispatch routing:

```typescript
export class CubicAgent {
  constructor(private agentClient: AgentClient, private server: AgentServer) {}
  
  // Start server and register dispatch handler in one call
  async start(handler: DispatchHandler): Promise<void>;
  async stop(): Promise<void>;  // Stop HTTP server
}

// Callback signature for dispatch handling with tool tracking
type DispatchHandler = (
  request: AgentRequest, 
  client: AgentClient, 
  context: CallContext
) => Promise<RawAgentResponse>;

// Context provides access to tool call count
interface CallContext {
  readonly toolCallCount: number;
}
```

**Key responsibilities:**
- HTTP server management (ExpressAgentServer by default)
- Request validation and routing
- Initialize AgentClient via `client.initialize()`
- Provide fresh `TrackingAgentClient` per request for tool call counting
- Transform `RawAgentResponse` to complete `AgentResponse` with metadata
- All errors thrown up to implementers

**Usage pattern:**
1. Create CubicAgent with AgentClient and AgentServer
2. Call `start(handler)` - CubicAgent provides tracking client and context to handler
3. Handler returns `RawAgentResponse`, CubicAgent adds timestamp and tool count

### AgentClient Interface

Interface for Cubicler MCP communication that can be easily mocked for testing:

```typescript
export interface AgentClient {
  initialize(): Promise<void>;
  callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>;
}

// JSON types for type safety (matching MCP protocol)
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue; }
export interface JSONArray extends Array<JSONValue> {}
```

**Key responsibilities:**
- Initialize connection to Cubicler (set up HTTP client, validate endpoints, etc.)
- Execute tool calls through Cubicler's `/mcp` endpoint
- Handle MCP protocol communication (JSON-RPC 2.0 format)
- Throw errors up for connection/communication failures

**Tool naming convention:**
- Internal tools: `cubicler_availableServers`, `cubicler_fetchServerTools`
- MCP servers: `{serverIdentifier}_{functionName}` (camelCase function names)
- REST servers: `{serverIdentifier}_{endpointName}` (camelCase endpoint names)

### AgentServer Interface

Interface for HTTP server management that can be customized for different environments:

```typescript
export interface AgentServer {
  start(handler: RequestHandler): Promise<void>;
  stop(): Promise<void>;
}

// Express-based default implementation with middleware support
export class ExpressAgentServer implements AgentServer {
  constructor(private port: number, private endpoint: string = '/agent') {}
  
  // Add middleware for CORS, auth, logging, etc.
  useMiddleware(middleware: ExpressMiddleware): this;
  // Implementation handles Express server lifecycle
}
```

**Key responsibilities:**
- HTTP server lifecycle management (start/stop)
- Route setup happens during start() with the provided handler
- Request/response handling with JSON parsing
- Middleware support for customization
- Default implementation uses Express.js

## 📋 Model Types (Copied from Cubicler)

### AgentRequest Type

```typescript
export interface AgentRequest {
  agent: {
    identifier: string;
    name: string;
    description: string;
    prompt: string;
  };
  tools: AgentTool[];
  servers: Array<{
    identifier: string;
    name: string;
    description: string;
  }>;
  messages: Message[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONValue>;
    required?: string[];
  };
}

export interface Message {
  sender: MessageSender;
  timestamp?: string; // ISO 8601, optional
  type: 'text' | 'null'; // text (image/video support planned), null for no content
  content: string | null;
}

export interface MessageSender {
  id: string;
  name?: string; // optional
}
```

### AgentResponse Types

```typescript
// What implementers provide - simplified interface
export interface RawAgentResponse {
  type: 'text' | 'null';
  content: string | null;
  usedToken: number;
}

// What the kit sends to Cubicler - complete interface
export interface AgentResponse {
  timestamp: string; // Added by kit
  type: 'text' | 'null';
  content: string | null;
  metadata: {
    usedToken: number; // From implementer
    usedTools: number; // Added by kit from tracking
  };
}
```

## 🔧 Implementation Utilities

### Built-in Tool Helpers

Since users have direct access to `client.callTool()` in their dispatch handlers, they can easily call Cubicler internal functions:

```typescript
// In your dispatch handler
const servers = await client.callTool('cubicler_availableServers', {});
const tools = await client.callTool('cubicler_fetchServerTools', { serverIdentifier: 'weatherService' });
const result = await client.callTool('weatherService_getCurrentWeather', { city: 'Paris' });
```

### Middleware Support

Both client and server support middleware for customization:

```typescript
// Add authentication to client requests
client.useMiddleware((config) => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Add CORS to server
server.useMiddleware((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
```

## 🔄 Usage Examples

### Basic Usage

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, AgentRequest, RawAgentResponse } from 'cubicagentkit';

// Create client and server with built-in implementations
const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const cubicAgent = new CubicAgent(client, server);

// Start server with dispatch handler
try {
  await cubicAgent.start(async (request: AgentRequest, client: AgentClient, context: CallContext) => {
    // Your AI processing logic here
    const lastMessage = request.messages[request.messages.length - 1];
    
    // Call Cubicler tools if needed
    if (lastMessage.content?.includes('weather')) {
      const weatherData = await client.callTool('weatherService_getCurrentWeather', {
        city: 'Paris',
        country: 'France'
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
  
  console.log('✅ [CubicAgent] Agent started successfully');
} catch (error) {
  console.error('❌ [CubicAgent] Failed to start agent:', error);
  process.exit(1);
}
```

### With Middleware

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer } from 'cubicagentkit';

// Create client with authentication middleware
const client = new AxiosAgentClient('http://localhost:1503')
  .useMiddleware((config) => {
    config.headers.Authorization = `Bearer ${process.env.CUBICLER_TOKEN}`;
    return config;
  });

// Create server with CORS middleware
const server = new ExpressAgentServer(3000, '/agent')
  .useMiddleware((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });

const cubicAgent = new CubicAgent(client, server);

// Same dispatch handler pattern
await cubicAgent.start(async (request, client, context) => {
  // Your logic here - client already has auth, server has CORS
  return {
    type: 'text',
    content: 'Processing complete',
    usedToken: 10
  };
});
```

## 🧪 Development Workflows

### Running Tests
```bash
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Run tests with UI
```

### Development Server
```bash
npm run dev           # Start with ts-node
npm run dev:watch     # Start with watch mode
```

### Build Process
- **TypeScript**: Compiles to ES modules with strict settings (`target: ES2020`, `module: ESNext`)
- **Build tool**: Uses `tsup` for fast bundling
- **Type definitions**: Generates `.d.ts` files automatically

## 🎯 Code Conventions

### Error Handling Pattern
All errors are thrown up to implementers with consistent structure:
```typescript
// CubicAgentKit throws specific error types
throw new ValidationError('Invalid request format');
throw new CubiclerCommunicationError('Failed to connect to Cubicler');

// Implementer catches and handles
try {
  await cubicAgent.start();
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('⚠️ [MyAgent] Configuration error:', error.message);
  } else if (error instanceof CubiclerCommunicationError) {
    console.error('❌ [MyAgent] Cubicler connection failed:', error.message);
  }
}
```

### TypeScript Patterns
- **Strict null checks** enabled - always handle undefined/null cases
- **ES modules** with `.js` extensions in imports
- **Interface segregation** - small, focused interfaces
- **Dependency injection** pattern for testability
- **Documentation** - All public methods have JSDoc documentation

### Testing Approach
- **Vitest** for testing framework with Node.js environment
- **Mock dependencies** using `vi.fn()` and interface implementations
- **Integration tests** for full agent workflow
- **Unit tests** mirror the `src/` structure

## 🚀 Package Configuration

### package.json Structure
```json
{
  "name": "cubicagentkit",
  "version": "2.1.0",
  "description": "Node.js library for creating AI agents that integrate with Cubicler",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "ts-node src/index.ts",
    "test": "vitest",
    "test:run": "vitest --run"
  },
  "dependencies": {
    "express": "^5.1.0", 
    "axios": "^1.11.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "tsup": "^8.5.0",
    "vitest": "^2.1.9",
    "@types/express": "^4.17.21"
  }
}
```

### Export Structure
```typescript
// src/index.ts - Main exports
export { CubicAgent } from './core/cubic-agent.js';
export { AxiosAgentClient } from './core/axios-agent-client.js';
export { ExpressAgentServer } from './core/express-agent-server.js';

// Interfaces
export type { AgentClient } from './interface/agent-client.js';
export type { AgentServer, DispatchHandler, CallContext } from './interface/agent-server.js';

// Model types
export type { AgentRequest } from './model/agent-request.js';
export type { AgentResponse, RawAgentResponse } from './model/agent-response.js';
export type { JSONValue, JSONObject, JSONArray } from './model/types.js';

// Middleware types
export type { RequestMiddleware } from './core/axios-agent-client.js';
export type { ExpressMiddleware } from './core/express-agent-server.js';
```

## ✅ Your Role

When I ask you for code, your job is to:
 • Build a simple, complete library using composition and dependency injection
 • Follow TypeScript best practices with strict typing
 • Create focused interfaces that can be easily implemented and tested
 • Throw errors up to implementers rather than handling them internally
 • Maintain compatibility with Cubicler 2.0 API contract
 • Keep the library lightweight and focused on agent creation
 • Ensure all public APIs are well-documented with JSDoc
 • Write comprehensive tests with mocked dependencies
 • Support middleware patterns for both client and server components

## ✅ DO NOT

 • Do not create abstract classes - use interfaces and composition
 • Do not handle errors internally - throw them up to implementers
 • Do not make the library opinionated about AI providers
 • Do not include AI provider implementations - keep it interface-based
 • Do not over-engineer - keep the core CubicAgent class simple and complete
 • Do not sacrifice type safety or testability
 • Do not make assumptions about how implementers want to handle errors

When working on CubicAgentKit, focus on creating a simple, complete, and testable library that makes it easy for developers to create Cubicler-compatible AI agents using composition and dependency injection patterns.
