# CubicAgentKit - AI Development Context

## 🎯 Project Overview

CubicAgentKit is an **npm library** that helps developers create AI agents for Cubicler 2.0 based on Node.js. It provides a simple, complete class-based approach using composition architecture with dependency injection for easy testing and flexibility.

**Current Version**: 2.3.0  
**Language**: TypeScript (ES2020, ESNext modules)  
**Build Tool**: tsup  
**Testing**: Vitest with Node.js environment  

## 🏗️ Architecture Philosophy

- **Composition over inheritance** - No abstract classes, use dependency injection
- **Simple and complete** - CubicAgent class handles all Cubicler integration
- **Error transparency** - All errors thrown up to implementers
- **Type safety** - Full TypeScript support with strict typing
- **Developer experience** - Built-in implementations with middleware support

## 📦 Core Package Structure

```
src/
  core/
    cubic-agent.ts               # Main CubicAgent orchestrator class
    axios-agent-client.ts        # HTTP client for Cubicler MCP communication
    express-agent-server.ts      # Express HTTP server for agent endpoints
    stdio-agent-client.ts        # Stdio client for Cubicler MCP communication
    stdio-agent-server.ts        # Stdio server for handling cubicler requests
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
  core/                          # Unit tests mirroring src/core structure
  mocks/                         # Mock implementations and test helpers
  integration/                   # Integration tests (excluded from CI)
```

## 🎯 Core Classes & Interfaces

### CubicAgent (Main Orchestrator)

```typescript
export class CubicAgent {
  constructor(private agentClient: AgentClient, private server: AgentServer) {}
  async start(handler: DispatchHandler): Promise<void>;
  async stop(): Promise<void>;
}
```

**Key responsibilities:**

- HTTP/Stdio server management
- Request validation and routing
- Initialize AgentClient via `client.initialize()`
- Provide fresh `TrackingAgentClient` per request for tool call counting
- Transform `RawAgentResponse` to complete `AgentResponse` with metadata

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

## 📋 Type Architecture & Patterns

### Clean Domain Models

All domain types (`AgentRequest`, `AgentResponse`, `AgentInfo`, etc.) are pure TypeScript interfaces without JSON protocol coupling.

### Type Safety at Boundaries

Type assertions only at protocol boundaries:

```typescript
// ✅ Good - explicit boundary assertion with comment
const agentRequest = request.params as unknown as AgentRequest; // Safe: validated below
const result = agentResponse as unknown as JSONValue; // Safe: JSON-serializable

// ❌ Bad - using any
const result = agentResponse as any;
```

### JSON Compatibility

```typescript
// JSON base types
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue; }
export type JSONArray = JSONValue[];
```

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

### Async Test Handling

```typescript
// Wait for async operations in tests
await new Promise(resolve => setTimeout(resolve, 0));
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

## 🔧 Development Standards

### Code Quality Rules

- **No `any` types** - Use proper TypeScript typing or `unknown` intermediate casts
- **Error handling** - Throw errors up to implementers, don't catch and ignore
- **SOLID principles** - Single responsibility, dependency injection, interface segregation
- **Composition over inheritance** - No abstract classes

### Linting & Type Issues

- **If linter is wrong** - Disable with explanatory comments
- **Unused imports** - Remove rather than disable warning
- **Constructor parameters** - Use `// eslint-disable-next-line no-unused-vars` for DI
- **Non-null assertions** - Use `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: reason`

### File Naming & Structure

- **Core classes**: `kebab-case.ts` (e.g., `stdio-agent-client.ts`)
- **Interfaces**: `kebab-case.ts` (e.g., `agent-client.ts`)  
- **Tests**: Mirror src structure with `.test.ts` suffix
- **Exports**: ES modules with `.js` extensions

## 📚 Usage Examples

### Basic HTTP Usage

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer } from 'cubicagentkit';

const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const agent = new CubicAgent(client, server);

await agent.start(async (request, client, context) => {
  const result = await client.callTool('weatherService_getCurrentWeather', { city: 'Paris' });
  return { type: 'text', content: `Weather: ${result}`, usedToken: 25 };
});
```

### Basic Stdio Usage  

```typescript
import { CubicAgent, StdioAgentClient, StdioAgentServer } from 'cubicagentkit';

const client = new StdioAgentClient('npx', ['cubicler', '--server']);
const server = new StdioAgentServer();
const agent = new CubicAgent(client, server);

await agent.start(async (request, client, context) => {
  const result = await client.callTool('weatherService_getCurrentWeather', { city: 'Paris' });
  return { type: 'text', content: `Weather: ${result}`, usedToken: 25 };
});
```

### Test Coverage

- **StdioAgentClient**: 18 tests (initialization, tool calls, error handling, lifecycle)
- **StdioAgentServer**: 22 tests (MCP protocol, validation, async handling, buffering)
- **All tests passing** as of latest implementation

## 📝 Development Notes

### When Adding New Features

1. **Follow composition pattern** - Create interfaces, provide implementations
2. **Add comprehensive tests** - Unit tests with mocks, integration tests if needed  
3. **Maintain type safety** - No `any`, proper boundary assertions only
4. **Update exports** - Add to `src/index.ts` for public API
5. **Document in CLAUDE.md** - Update this file for future context

### When Fixing Issues

1. **Understand the architecture** - Check interfaces and existing patterns
2. **Write tests first** - Reproduce issue, then fix
3. **Maintain backward compatibility** - Don't break existing API
4. **Follow error handling** - Throw up to implementers

### Tool Commands for Common Tasks

```bash
# Run specific test files
npm test -- stdio
npm test -- cubic-agent

# Build and check types
npm run build

# Run linter (if available)  
npm run lint

# Check integration tests (excluded from CI)
cd tests/integration && npm test
```

This document serves as the primary context for future AI development sessions with CubicAgentKit. Always refer to this when working on the project to maintain consistency with established patterns and architecture.
