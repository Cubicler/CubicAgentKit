# CubicAgentKit AI Development Instructions

CubicAgentKit is an **npm library** that helps developers create AI agents for Cubicler 2.0 based on Node.js. It provides a simple, complete class-based approach using composition architecture with dependency injection for easy testing and flexibility.

## 🧱 System Overview

CubicAgentKit simplifies the creation of **CubicAgents** that integrate with Cubicler by providing:
- A complete `CubicAgent` class that handles HTTP/Stdio server setup and Cubicler communication
- Built-in `AxiosAgentClient` and `StdioAgentClient` for Cubicler MCP communication with middleware support
- Built-in `ExpressAgentServer` and `StdioAgentServer` for HTTP/Stdio server management with middleware support
- Production-ready memory system with `SQLiteMemory` persistent storage and `LRUShortTermMemory` caching
- Automatic tool call tracking with `TrackingAgentClient` wrapper
- Type-safe request/response handling matching Cubicler's API contract
- Simplified developer interface with `RawAgentResponse` (kit adds timestamp and tool count)
- Error propagation to implementers for custom handling

**Architecture Philosophy:**
- **Composition over inheritance** - No abstract classes, use dependency injection
- **Interface-based design** - `PersistentMemory`, `ShortTermMemory`, `AgentClient`, `AgentServer`, `MemoryRepository` interfaces
- **Simple and complete** - CubicAgent class handles all Cubicler integration
- **Error transparency** - All errors thrown up to implementers
- **Type safety** - Full TypeScript support with strict typing
- **Developer experience** - Built-in implementations with middleware support

## 🏗️ Core Architecture

### Composition-Based Design
```typescript
class CubicAgent {
  constructor(
    private agentClient: AgentClient, 
    private server: AgentServer,
    private memory?: MemoryRepository
  ) {}
}
```

### Key Interfaces & Implementations
- **AgentClient**: `AxiosAgentClient`, `StdioAgentClient` - Cubicler MCP communication
- **AgentServer**: `ExpressAgentServer`, `StdioAgentServer` - HTTP/Stdio servers
- **MemoryRepository**: `AgentMemoryRepository` - Two-tier memory (SQLite + LRU cache)
- **TrackingAgentClient** - Automatic tool call counting wrapper

## 📦 Package Structure

```typescript
src/
  core/cubic-agent.ts                      # Main CubicAgent orchestrator with memory
  client/{axios,stdio,tracking}-agent-client.ts  # HTTP/Stdio clients + tracking
  server/{express,stdio}-agent-server.ts   # HTTP/Stdio servers
  interface/                               # All interface definitions
  memory/                                  # Memory system (SQLite + LRU)
  model/                                   # Types (AgentRequest, AgentResponse, MCP, etc.)
  utils/memory-utils.ts                    # Memory utilities
tests/                                     # Unit tests mirroring src structure
```

## 🎯 Core Classes & Interfaces

### CubicAgent (Main Orchestrator)
```typescript
export class CubicAgent {
  constructor(
    private agentClient: AgentClient, 
    private server: AgentServer,
    private memory?: MemoryRepository
  ) {}
  async start(handler: DispatchHandler): Promise<void>;
  async stop(): Promise<void>;
}

type DispatchHandler = (
  request: AgentRequest, 
  client: AgentClient, 
  context: CallContext
) => Promise<RawAgentResponse>;

interface CallContext {
  readonly toolCallCount: number;
  memory?: MemoryRepository;
}
```

**Responsibilities:** Server management, request routing, client initialization, tool tracking, memory injection, response transformation.

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
- Internal tools: `cubicler_available_servers`, `cubicler_fetch_server_tools`
- MCP servers: `{serverIdentifier}_{functionName}` (camelCase function names)
- REST servers: `{serverIdentifier}_{endpointName}` (camelCase endpoint names)

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

async function createMemoryRepository(
  longTerm: SQLiteMemory,
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
## 📋 Model Types (Copied from Cubicler)

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

## 🔄 Usage Examples

### Basic Usage with Memory

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, createSQLiteMemoryRepository } from 'cubicagentkit';

const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const memory = await createSQLiteMemoryRepository('./agent-memories.db');
const cubicAgent = new CubicAgent(client, server, memory);

await cubicAgent.start(async (request, client, context) => {
  const lastMessage = request.messages[request.messages.length - 1];
  
  // Store user preferences in memory
  if (lastMessage.content?.includes('I prefer')) {
    const memoryId = await context.memory?.remember(
      lastMessage.content,
      0.8,
      ['user_preference', 'communication']
    );
  }
  
  // Search relevant memories for context
  const relevantMemories = await context.memory?.search({
    tags: ['user_preference'],
    limit: 3,
    sortBy: 'importance'
  });
  
  // Call Cubicler tools if needed
  if (lastMessage.content?.includes('weather')) {
    const weatherData = await client.callTool('weatherService_getCurrentWeather', {
      city: 'Paris',
      country: 'France'
    });
    
    // Store the interaction
    await context.memory?.remember(
      `User asked about weather in Paris, temperature was ${weatherData.temperature}°C`,
      0.6,
      ['weather', 'interaction', 'paris']
    );
    
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
```

### Custom Memory Setup

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, createMemoryRepository, SQLiteMemory } from 'cubicagentkit';

// Create custom SQLite instance
const longTerm = new SQLiteMemory('./custom-path.db');

// Use generic factory with LRU short-term memory as default
const memory = await createMemoryRepository(longTerm, 3000, 0.8);

const cubicAgent = new CubicAgent(client, server, memory);

await cubicAgent.start(async (request, client, context) => {
  // Memory system automatically uses LRUShortTermMemory for caching
  const memoryId = await context.memory?.remember(
    'Custom memory setup example',
    0.7,
    ['example', 'custom']
  );
  
  return {
    type: 'text',
    content: 'Processing with custom memory setup...',
    usedToken: 10
  };
});
```

### With Middleware and Custom Memory

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, createDefaultMemoryRepository } from 'cubicagentkit';

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

// Create in-memory SQLite for development
const memory = await createDefaultMemoryRepository(2000, 0.7);

const cubicAgent = new CubicAgent(client, server, memory);

// Same dispatch handler pattern with memory
await cubicAgent.start(async (request, client, context) => {
  // Memory operations
  const stats = await context.memory?.getStats();
  console.log(`Memory usage: ${stats?.shortTermCount} memories in cache`);
  
  // Your logic here - client already has auth, server has CORS, memory available
  return {
    type: 'text',
    content: 'Processing complete with memory context',
    usedToken: 10
  };
});
```

### Generic Memory Factory Usage

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, createMemoryRepository, SQLiteMemory } from 'cubicagentkit';

// Create custom SQLite instance
const longTerm = new SQLiteMemory('./custom-path.db');

// Use generic factory with LRU short-term memory as default
const memory = await createMemoryRepository(longTerm, 3000, 0.8);

const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const cubicAgent = new CubicAgent(client, server, memory);

await cubicAgent.start(async (request, client, context) => {
  // Memory system automatically uses LRUShortTermMemory for caching
  const memoryId = await context.memory?.remember(
    'Custom memory setup example',
    0.7,
    ['example', 'custom']
  );
  
  return {
    type: 'text',
    content: 'Processing with custom memory setup...',
    usedToken: 10
  };
});
```

## 🚀 Package Configuration

### package.json Structure
```json
{
  "name": "cubicagentkit",
  "version": "2.1.0",
  "description": "Node.js library for creating AI agents that integrate with Cubicler",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module"
}
```

### Export Structure
```typescript
// src/index.ts - Main exports
export { CubicAgent } from './core/cubic-agent.js';
export { AxiosAgentClient } from './client/axios-agent-client.js';
export { ExpressAgentServer } from './server/express-agent-server.js';

// Memory system
export { 
  AgentMemoryRepository, 
  SQLiteMemory, 
  LRUShortTermMemory,
  createDefaultMemoryRepository,
  createSQLiteMemoryRepository,
  createMemoryRepository
} from './memory/memory-index.js';

// Interfaces
export type { AgentClient } from './interface/agent-client.js';
export type { AgentServer, DispatchHandler, CallContext } from './interface/agent-server.js';
export type { MemoryRepository, AgentMemory, MemorySearchOptions } from './interface/memory-repository.js';
export type { PersistentMemory } from './interface/persistent-memory.js';
export type { ShortTermMemory } from './interface/short-term-memory.js';

// Model types
export type { AgentRequest } from './model/agent-request.js';
export type { AgentResponse, RawAgentResponse } from './model/agent-response.js';
export type { JSONValue, JSONObject, JSONArray } from './model/types.js';

// Memory types
export type { MemoryConfig, MemoryItem, MemoryStats } from './model/memory.js';

// Middleware types
export type { RequestMiddleware } from './client/axios-agent-client.js';
export type { ExpressMiddleware } from './server/express-agent-server.js';
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
 • Implement memory system with sentence-based storage and proper interfaces
 • Use SQLite for production persistence and LRU caching for performance

## ✅ DO NOT

 • Do not create abstract classes - use interfaces and composition
 • Do not handle errors internally - throw them up to implementers
 • Do not make the library opinionated about AI providers
 • Do not include AI provider implementations - keep it interface-based
 • Do not over-engineer - keep the core CubicAgent class simple and complete
 • Do not sacrifice type safety or testability
 • Do not make assumptions about how implementers want to handle errors
 • Do not use mock implementations in production code - use proper SQLite storage
 • Do not create complex memory hierarchies - keep it simple with two-tier system

When working on CubicAgentKit, focus on creating a simple, complete, and testable library that makes it easy for developers to create Cubicler-compatible AI agents using composition and dependency injection patterns with robust memory capabilities.

## 🌍 Global Development Standards & Best Practices

### 🎯 Core Philosophy

Write code that is clean, maintainable, testable, and scalable. Always prioritize code readability and long-term maintainability over short-term convenience. Prefer simple, focused code over complex abstractions - it's better to have code that does one thing well than code that tries to be reusable for everything.

### 📐 SOLID Principles (Universal)

Always follow SOLID principles when writing code:

• **Single Responsibility Principle** - Each class/function/module should have one reason to change
• **Open/Closed Principle** - Open for extension, closed for modification  
• **Liskov Substitution Principle** - Derived classes must be substitutable for their base classes
• **Interface Segregation Principle** - Many specific interfaces are better than one general-purpose interface
• **Dependency Inversion Principle** - Depend on abstractions, not concretions

### 🛠️ Method & Function Design

**Method Length & Complexity:**
• Break down long methods/functions into smaller, focused units that each handle a specific responsibility
• Avoid redundant wrapper methods that only call one private method without additional logic
• Single responsibility per method - each method should do one thing well
• Meaningful names that clearly describe what the method does

**Parameters & Return Values:**
• Limit parameters - if you need more than 3-4 parameters, consider using a configuration object/struct
• Consistent return types - avoid functions that sometimes return different types
• Fail fast - validate inputs early and throw meaningful errors

### 🏗️ Architecture Principles

**Modularity & Separation of Concerns:**
• Service-oriented design with clear separation of responsibilities
• Dependency injection for testability and flexibility
### ✅ Your Role as a Developer/AI Assistant (Global Standards)

When working on any codebase, your job is to:

• Follow these global standards while adapting to language-specific conventions
• Write clean, maintainable code that other developers can easily understand and modify
• Think about long-term maintainability - code is read more often than it's written
• Design for extensibility - anticipate future changes and requirements
• Prioritize code quality over speed of delivery
• Ask questions when requirements are unclear rather than making assumptions
• Implement exactly what is requested - don't add features or functionality that wasn't asked for
• Consider the bigger picture - how does this code fit into the overall system?
• Be consistent with existing patterns and conventions in the codebase
• Document decisions that might not be obvious to future developers
• Test your code and consider edge cases

### ❌ DO NOT (Global Standards)

• Do not sacrifice code quality for quick fixes or tight deadlines
• Do not write monolithic functions/classes - break them down into manageable pieces
• Do not ignore error handling - always consider what can go wrong and let errors surface
• Do not catch and swallow exceptions - only catch errors you can meaningfully handle or recover from
• Do not hide failures - if something fails, it should be visible and actionable
• Do not hardcode values - use configuration files or constants
• Do not copy-paste code without understanding what it does
• Do not leave TODO comments in production code without tracking them
• Do not commit commented-out code - use version control instead
• Do not ignore linting/formatting tools - consistency matters
• Do not skip documentation for public APIs and complex business logic
• Do not make breaking changes without proper versioning and migration paths
• Do not optimize prematurely - measure first, then optimize
• Do not force code reuse - avoid creating complicated abstractions just to eliminate duplication
• Do not create "Swiss Army knife" functions - functions that try to do everything for everyone
• Do not sacrifice simplicity for reusability - simple, testable code is better than complex reusable code
• Do not reinvent the wheel - use established libraries and patterns when appropriate, but don't force custom reuse
• Do not ignore security considerations - think about potential vulnerabilities
• Do not add unrequested features - implement exactly what is asked for, nothing more
• Do not make assumptions about data or user behavior - validate everything
• Do not implement "nice to have" features without explicit request - stick to requirements

These standards are living guidelines that should evolve with experience and changing best practices. The goal is to write code that is a joy to work with, both now and in the future.
