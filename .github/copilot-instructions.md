# CubicAgentKit AI Development Instruction**Service-Oriented Architecture**
Following Cubicler's patterns with focused interfaces:

- **`AgentClient`** - Interface for Cubicler MCP communication
- **`AxiosAgentClient`** - Built-in HTTP client with middleware support
- **`AgentServer`** - Interface for HTTP server management
- **`ExpressAgentServer`** - Built-in Express server with middleware support
- **`TrackingAgentClient`** - Wrapper that automatically tracks tool calls per request
- **`MemoryRepository`** - Interface for agent memory systems
- **`PersistentMemory`** - Interface for long-term storage (SQLite, Redis, etc.)
- **`ShortTermMemory`** - Interface for LRU caching systems
- **`AgentMemoryRepository`** - Complete two-tier memory implementation
- **`SQLiteMemory`** - Production-ready persistent storage with search capabilities
- **`LRUShortTermMemory`** - Token-based LRU cache for frequently accessed memories

Key services instantiated with dependency injection:
```typescript
// Built-in implementations for immediate use
const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const memory = await createSQLiteMemoryRepository('./memories.db');
const agent = new CubicAgent(client, server, memory);
``` is an **npm library** that helps developers create AI agents for Cubicler 2.0 based on Node.js. It provides a simple, complete class-based approach using composition architecture with dependency injection for easy testing and flexibility.

## 🧱 System Overview

CubicAgentKit simplifies the creation of **CubicAgents** that integrate with Cubicler by providing:
- A complete `CubicAgent` class that handles HTTP server setup and Cubicler communication
- Built-in `AxiosAgentClient` for Cubicler MCP communication with middleware support
- Built-in `ExpressAgentServer` for HTTP server management with middleware support
- Production-ready memory system with `SQLiteMemory` persistent storage and `LRUShortTermMemory` caching
- Automatic tool call tracking with `TrackingAgentClient` wrapper
- Type-safe request/response handling matching Cubicler's API contract
- Simplified developer interface with `RawAgentResponse` (kit adds timestamp and tool count)
- Error propagation to implementers for custom handling

**Architecture Philosophy:**
- **Composition over inheritance** - No abstract classes, use dependency injection
- **Interface-based design** - `PersistentMemory`, `ShortTermMemory`, `AgentClient`, `AgentServer` interfaces
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
    cubic-agent.ts               # Main CubicAgent class with memory integration
  client/
    axios-agent-client.ts        # Axios-based Cubicler client with middleware
    tracking-agent-client.ts     # Tool call tracking wrapper
  server/
    express-agent-server.ts      # Express-based HTTP server with middleware
  interface/
    agent-client.ts              # AgentClient interface
    agent-server.ts              # AgentServer interface and handler types
    memory-repository.ts         # MemoryRepository interface
    persistent-memory.ts         # PersistentMemory interface
    short-term-memory.ts         # ShortTermMemory interface
  memory/
    agent-memory-repository.ts   # Main memory orchestrator
    sqlite-memory.ts             # SQLite-based persistent storage
    lru-short-term-memory.ts     # LRU-based short-term cache
    memory-types.ts              # Memory-related type definitions
    memory-utils.ts              # Memory utilities and validators
    memory-index.ts              # Memory system exports and factories
  model/
    agent-request.ts             # AgentRequest type (from Cubicler)
    agent-response.ts            # AgentResponse & RawAgentResponse types
    mcp-protocol.ts              # MCP JSON-RPC 2.0 protocol types
    types.ts                     # Common JSON and Cubicler types
tests/
  core/
    cubic-agent.test.ts          # CubicAgent unit tests
    tracking-agent-client.test.ts # Tool tracking tests
  memory/
    lru-short-term-memory.test.ts # LRU cache tests
    memory-utils.test.ts         # Memory utilities tests
  mocks/
    mock-agent-client.ts         # Mock implementations for testing
    mock-agent-server.ts         # Mock server for testing
    test-helpers.ts              # Test utilities
```

## 🎯 Core Classes & Interfaces

### CubicAgent Class

The main orchestrator class that handles HTTP server, dispatch routing, and memory integration:

```typescript
export class CubicAgent {
  constructor(
    private agentClient: AgentClient, 
    private server: AgentServer,
    private memory?: MemoryRepository
  ) {}
  
  // Start server and register dispatch handler in one call
  async start(handler: DispatchHandler): Promise<void>;
  async stop(): Promise<void>;  // Stop HTTP server
}

// Callback signature for dispatch handling with tool tracking and memory access
type DispatchHandler = (
  request: AgentRequest, 
  client: AgentClient, 
  context: CallContext
) => Promise<RawAgentResponse>;

// Context provides access to tool call count and optional memory
interface CallContext {
  readonly toolCallCount: number;
  memory?: MemoryRepository;
}
```

**Key responsibilities:**
- HTTP server management (ExpressAgentServer by default)
- Request validation and routing
- Initialize AgentClient via `client.initialize()`
- Provide fresh `TrackingAgentClient` per request for tool call counting
- Inject memory repository into context for agent handlers
- Transform `RawAgentResponse` to complete `AgentResponse` with metadata
- All errors thrown up to implementers

**Usage pattern:**
1. Create CubicAgent with AgentClient, AgentServer, and optional MemoryRepository
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
- Internal tools: `cubicler_available_servers`, `cubicler_fetch_server_tools`
- MCP servers: `{serverIdentifier}_{functionName}` (camelCase function names)
- REST servers: `{serverIdentifier}_{endpointName}` (camelCase endpoint names)

### Memory System Interfaces

The memory system provides persistent storage and context management for agents:

```typescript
// Main memory repository interface
export interface MemoryRepository {
  remember(sentence: string, importance?: number, tags: string[]): Promise<string>;
  recall(id: string): Promise<AgentMemory | null>;
  search(options: MemorySearchOptions): Promise<AgentMemory[]>;
  editImportance(id: string, importance: number): Promise<boolean>;
  editContent(id: string, sentence: string): Promise<boolean>;
  addTag(id: string, tag: string): Promise<boolean>;
  removeTag(id: string, tag: string): Promise<boolean>;
  forget(id: string): Promise<boolean>;
  getStats(): Promise<MemoryStats>;
}

// Persistent storage interface (SQLite, PostgreSQL, etc.)
export interface PersistentMemory {
  initialize(): Promise<void>;
  store(memory: MemoryItem): Promise<void>;
  retrieve(id: string): Promise<AgentMemory | null>;
  search(options: MemorySearchOptions): Promise<AgentMemory[]>;
  update(id: string, updates: Partial<MemoryItem>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  close(): Promise<void>;
}

// Short-term cache interface (LRU, Redis, etc.)
export interface ShortTermMemory {
  get(id: string): AgentMemory | null;
  put(memory: MemoryItem): MemoryItem | null;
  remove(id: string): AgentMemory | null;
  getAll(): AgentMemory[];
  getCurrentTokenCount(): number;
  getMaxTokenCount(): number;
  clear(): void;
}
```

**Key implementations:**
- **AgentMemoryRepository**: Two-tier orchestrator combining persistent and short-term storage
- **SQLiteMemory**: Production-ready persistent storage with full-text search and indexing
- **LRUShortTermMemory**: Token-based LRU cache with automatic eviction
- **createSQLiteMemoryRepository()**: Factory for production setup
- **createDefaultMemoryRepository()**: Factory for development (in-memory SQLite)

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
const servers = await client.callTool('cubicler_available_servers', {});
const tools = await client.callTool('cubicler_fetch_server_tools', { serverIdentifier: 'weatherService' });
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

### Basic Usage with Memory

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, createSQLiteMemoryRepository } from 'cubicagentkit';

// Create client, server, and memory with built-in implementations
const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const memory = await createSQLiteMemoryRepository('./agent-memories.db');
const cubicAgent = new CubicAgent(client, server, memory);

// Start server with dispatch handler
try {
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
} catch (error) {
  console.error('❌ [CubicAgent] Failed to start agent:', error);
  process.exit(1);
}
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
export { AxiosAgentClient } from './client/axios-agent-client.js';
export { ExpressAgentServer } from './server/express-agent-server.js';

// Memory system
export { 
  AgentMemoryRepository, 
  SQLiteMemory, 
  LRUShortTermMemory,
  createDefaultMemoryRepository,
  createSQLiteMemoryRepository 
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
export type { MemoryConfig, MemoryItem, MemoryStats } from './memory/memory-types.js';

// Middleware types
export type { RequestMiddleware } from './client/axios-agent-client.js';
export type { ExpressMiddleware } from './server/express-agent-server.js';
```

## 🔧 Linting and Code Quality Rules

When fixing linting issues or working with code quality tools:

- **If the linter is wrong** (like when they said something unused, but it's actually used) just disable the linter on that particular warning or error with explanatory comments
- **If you need to add an import**, add it to the top of the file with other imports
- **Import that are allowed in middle of the file** are only the imports used for singleton instances (at the bottom of service files)
- **Always use proper TypeScript types** instead of `any` - create new type definitions when needed
- **For constructor parameters flagged as unused** but are actually used as dependency injection, use `// eslint-disable-next-line no-unused-vars` 
- **For safe non-null assertions** where you've verified the value exists, use `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: reason`
- **Remove truly unused imports** rather than disabling the warning
- **Fix formatting issues** automatically with `--fix` flag when possible

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
• Interface/contract-based programming - depend on abstractions, not implementations
• Avoid monolithic classes/modules - break them into focused, cohesive units

**Error Handling:**
• Throw errors, don't catch and ignore - let errors bubble up unless they are expected and recoverable
• Fail fast - validate inputs early and throw meaningful errors immediately
• Consistent error handling patterns across the entire codebase
• Meaningful error messages that help developers understand what went wrong and how to fix it
• Log at appropriate levels with context and structured data
• Only catch errors you can handle - if you can't recover or provide meaningful handling, let it throw
• Expected errors should be handled gracefully - but unexpected errors should surface quickly

### 📝 Code Quality Standards

**Naming Conventions:**
• Descriptive names - code should be self-documenting
• Consistent naming patterns within each project/language
• Avoid abbreviations unless they're industry standard
• Boolean variables/functions should be clearly boolean (is/has/can/should prefixes)

**Comments & Documentation:**
• Code should be self-documenting - prefer clear code over comments
• Document the "why", not the "what" - explain business logic and decisions
• Keep documentation up-to-date with code changes
• API documentation for all public interfaces

**Testing Philosophy:**
• Write testable code - design with testing in mind
• Unit tests for business logic - test behavior, not implementation
• Integration tests for workflows - test how components work together
• Test edge cases and error conditions

### 🔄 Development Workflow

**Refactoring:**
• Continuous refactoring - improve code quality incrementally
• Test before and after refactoring to ensure behavior is preserved
• Remove dead code - don't leave commented-out code
• DRY principle with wisdom - Don't Repeat Yourself, but avoid premature abstraction and forced reuse
• Prefer simple duplication over complex abstraction - if reuse makes code complicated, duplicate and keep it simple
• One thing well - better to have multiple simple functions than one complex reusable one

### ⚡ Performance Considerations

**Optimization Philosophy:**
• Measure before optimizing - profile and identify actual bottlenecks
• Readability first, optimize later - don't sacrifice clarity for micro-optimizations
• Cache appropriately - but avoid premature caching
• Consider scalability from the design phase

**Resource Management:**
• Clean up resources - close files, connections, release memory appropriately
• Efficient algorithms - choose appropriate data structures and algorithms
• Lazy loading where appropriate to improve startup time

### 🔒 Security Best Practices

**Input Validation:**
• Validate all inputs at system boundaries
• Sanitize data before processing or storage
• Use parameterized queries to prevent injection attacks
• Implement proper authentication and authorization

**Data Protection:**
• Never log sensitive data (passwords, tokens, personal info)
• Use environment variables for configuration and secrets
• Encrypt sensitive data at rest and in transit
• Follow principle of least privilege

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

### 🎯 Language-Specific Notes

While these principles apply universally, remember to:

• Follow language idioms and established conventions
• Use language-specific tools for testing, linting, and formatting
• Leverage language strengths - don't fight the language design
• Stay updated with language best practices and evolving standards
• Use appropriate design patterns for the specific language/framework

### 📋 Quick Checklist

Before considering any piece of code "done":

- [ ] Does it follow SOLID principles?
- [ ] Is each method/function focused on a single responsibility?
- [ ] Are names descriptive and consistent?
- [ ] Is error handling appropriate and consistent?
- [ ] Is it testable and tested?
- [ ] Is it documented where necessary?
- [ ] Does it follow project conventions?
- [ ] Is it secure and performant enough?
- [ ] Will it be maintainable in 6 months?

These standards are living guidelines that should evolve with experience and changing best practices. The goal is to write code that is a joy to work with, both now and in the future.
