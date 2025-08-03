# CubicAgentKit - AI Development Context

## 🎯 Project Overview

CubicAgentKit is an **npm library** that helps developers create AI agents for Cubicler 2.0 based on Node.js. It provides a simple, complete class-based approach using composition architecture with dependency injection for easy testing and flexibility.

**Current Version**: 2.3.0  
**Language**: TypeScript (ES2020, ESNext modules)  
**Build Tool**: tsup  
**Testing**: Vitest with Node.js environment  

## 🏗️ Architecture Philosophy

- **Composition over inheritance** - No abstract classes, use dependency injection
- **Interface-based design** - `PersistentMemory`, `ShortTermMemory`, `AgentClient`, `AgentServer` interfaces
- **Simple and complete** - CubicAgent class handles all Cubicler integration
- **Error transparency** - All errors thrown up to implementers
- **Type safety** - Full TypeScript support with strict typing
- **Developer experience** - Built-in implementations with middleware support
- **Memory system** - Sentence-based memory with SQLite persistence and LRU caching

## 📦 Core Package Structure

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

```typescript
export interface AgentClient {
  initialize(): Promise<void>;
  callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>;
}
```

**Implementations:**

- `AxiosAgentClient` - HTTP communication with Cubicler MCP endpoint
- `StdioAgentClient` - Stdio communication with cubicler MCP server

### AgentServer Interface  

```typescript
export interface AgentServer {
  start(handler: RequestHandler): Promise<void>;
  stop(): Promise<void>;
}
```

**Implementations:**

- `ExpressAgentServer` - HTTP server using Express.js
- `StdioAgentServer` - Stdio server using stdin/stdout

## 🧠 Memory System Architecture

### Memory Factory Functions

```typescript
// For development with in-memory SQLite
async function createDefaultMemoryRepository(
  maxTokens?: number,
  defaultImportance?: number
): Promise<AgentMemoryRepository>

// For production with file-based SQLite
async function createSQLiteMemoryRepository(
  dbPath: string,
  maxTokens?: number,
  defaultImportance?: number
): Promise<AgentMemoryRepository>

// Generic factory with custom SQLite instance
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

## 🔧 Communication Protocols

### HTTP Mode (Traditional)

- **Client**: `AxiosAgentClient` → Cubicler HTTP `/mcp` endpoint
- **Server**: `ExpressAgentServer` → Handles HTTP requests from Cubicler
- **Use case**: Web deployments, REST API integrations

### Stdio Mode (New)

- **Client**: `StdioAgentClient` → Spawns cubicler MCP server process via stdio
- **Server**: `StdioAgentServer` → Handles stdin/stdout requests from cubicler  
- **Use case**: CLI tools, local development, process-based integrations

Both modes use **MCP JSON-RPC 2.0** protocol for tool communication.

## 🧪 Testing Patterns

### Unit Tests (Vitest)

- **Location**: `tests/core/` mirrors `src/core/`
- **Mocking**: Use `vi.fn()` and interface implementations
- **Pattern**: Mock dependencies, test behavior not implementation

### Mock Strategy

```typescript
// Mock external dependencies at module level
vi.mock('child_process', () => ({ spawn: vi.fn() }));

// Use dependency injection for internal mocking
const mockClient = new MockAgentClient();
const cubicAgent = new CubicAgent(mockClient, mockServer);
```

## 🚀 Build & Development

### Scripts

```bash
npm run build      # Build with tsup (ES modules + .d.ts)
npm test          # Run tests in watch mode  
npm run test:run  # Run tests once
npm run lint      # Run linter (if available)
```

### TypeScript Configuration

- **Target**: ES2023
- **Module**: ESNext  
- **Strict**: Enabled
- **Output**: ES modules with `.js` extensions in imports

## 📚 Usage Examples

### Basic HTTP Usage

```typescript
import { 
  CubicAgent, 
  AxiosAgentClient, 
  ExpressAgentServer,
  createDefaultMemoryRepository
} from 'cubicagentkit';

const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const memory = await createDefaultMemoryRepository(); // In-memory SQLite
const agent = new CubicAgent(client, server, memory);

await agent.start(async (request, client, context) => {
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
  
  const result = await client.callTool('weatherService_getCurrentWeather', { city: 'Paris' });
  return { 
    type: 'text', 
    content: `Weather: ${result} (${context.toolCallCount} tools used)`, 
    usedToken: 25 
  };
});
```

### Basic Stdio Usage  

```typescript
import { 
  CubicAgent, 
  StdioAgentClient, 
  StdioAgentServer,
  createSQLiteMemoryRepository
} from 'cubicagentkit';

const client = new StdioAgentClient('npx', ['cubicler', '--server']);
const server = new StdioAgentServer();
const memory = await createSQLiteMemoryRepository('./agent-memories.db');
const agent = new CubicAgent(client, server, memory);

await agent.start(async (request, client, context) => {
  // Memory operations available in context
  const stats = await context.memory?.getStats();
  console.log(`Memory usage: ${stats?.shortTermCount} memories in cache`);
  
  const result = await client.callTool('weatherService_getCurrentWeather', { city: 'Paris' });
  return { 
    type: 'text', 
    content: `Weather: ${result}`, 
    usedToken: 25 
  };
});
```

### Custom Memory Setup

```typescript
import { 
  CubicAgent, 
  AxiosAgentClient, 
  ExpressAgentServer,
  createMemoryRepository,
  SQLiteMemory
} from 'cubicagentkit';

// Create custom SQLite instance
const longTerm = new SQLiteMemory('./custom-path.db');

// Use generic factory with LRU short-term memory as default
const memory = await createMemoryRepository(longTerm, 3000, 0.8);

const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const agent = new CubicAgent(client, server, memory);

await agent.start(async (request, client, context) => {
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

### Test Coverage

- **Core**: CubicAgent with memory integration tests
- **Client**: AxiosAgentClient, StdioAgentClient (18 tests), TrackingAgentClient
- **Server**: ExpressAgentServer, StdioAgentServer (22 tests)
- **Memory**: AgentMemoryRepository, SQLiteMemory, LRUShortTermMemory
- **Utils**: Memory utilities and validation functions
- **All tests passing** with comprehensive coverage

## 📝 Development Notes

### When Adding New Features

1. **Follow composition pattern** - Create interfaces, provide implementations
2. **Add comprehensive tests** - Unit tests with mocks, integration tests if needed  
3. **Maintain type safety** - No `any`, proper boundary assertions only
4. **Update exports** - Add to `src/index.ts` for public API
5. **Update memory system** - Consider memory integration for stateful features
6. **Document in CLAUDE.md** - Update this file for future context

### When Fixing Issues

1. **Understand the architecture** - Check interfaces and existing patterns
2. **Write tests first** - Reproduce issue, then fix
3. **Maintain backward compatibility** - Don't break existing API
4. **Follow error handling** - Throw up to implementers
5. **Consider memory implications** - How does the fix affect memory operations

### Tool Commands for Common Tasks

```bash
# Run specific test files
npm test -- stdio
npm test -- cubic-agent
npm test -- memory

# Build and check types
npm run build

# Run linter (if available)  
npm run lint

# Check integration tests (excluded from CI)
cd tests/integration && npm test

# Memory-specific tests
npm test -- lru-short-term-memory
npm test -- memory-utils
```

This document serves as the primary context for future AI development sessions with CubicAgentKit. Always refer to this when working on the project to maintain consistency with established patterns and architecture.
