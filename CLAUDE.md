# CubicAgentKit - AI Development Context

## Project Overview

**npm library** for creating AI agents for Cubicler 2.0. TypeScript with composition architecture, dependency injection, and memory system.

- **Version**: 2.3.0, **Build**: tsup, **Test**: Vitest
- **Architecture**: Composition over inheritance, interface-based design, error transparency

## Core Structure

```
src/
  core/cubic-agent.ts              # Main orchestrator with memory
  client/                          # HTTP/Stdio clients + tracking
  server/                          # HTTP/Stdio servers  
  interface/                       # All interfaces
  memory/                          # SQLite + LRU memory system
  model/                           # Types & models
```

## Key Components

### CubicAgent

```typescript
class CubicAgent {
  constructor(client: AgentClient, server: AgentServer, memory?: MemoryRepository)
  async start(handler: DispatchHandler): Promise<void>
}

type DispatchHandler = (request: AgentRequest, client: AgentClient, context: CallContext) => Promise<RawAgentResponse>

interface CallContext {
  readonly toolCallCount: number;
  memory?: MemoryRepository;
}
```

### Communication Modes

- **HTTP**: `AxiosAgentClient` + `ExpressAgentServer` (web deployments)
- **Stdio**: `StdioAgentClient` + `StdioAgentServer` (CLI/local dev)
- Both use MCP JSON-RPC 2.0 protocol

### Memory System

```typescript
// Factory functions
createDefaultMemoryRepository(maxTokens?, defaultImportance?) // In-memory SQLite
createSQLiteMemoryRepository(dbPath, maxTokens?, defaultImportance?) // File-based
createMemoryRepository(longTerm: SQLiteMemory, maxTokens?, defaultImportance?) // Custom

// Core operations
interface MemoryRepository {
  remember(sentence: string, importance?: number, tags: string[]): Promise<string>
  search(options: MemorySearchOptions): Promise<AgentMemory[]>
  recall(id: string): Promise<AgentMemory | null>
  // edit, tag, forget methods...
}
```

## Quick Usage

### HTTP Mode

```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, createDefaultMemoryRepository } from 'cubicagentkit';

const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const memory = await createDefaultMemoryRepository();
const agent = new CubicAgent(client, server, memory);

await agent.start(async (request, client, context) => {
  await context.memory?.remember('User interaction', 0.8, ['interaction']);
  const result = await client.callTool('toolName', { params });
  return { type: 'text', content: `Result: ${result}`, usedToken: 25 };
});
```

### Stdio Mode

```typescript
import { CubicAgent, StdioAgentClient, StdioAgentServer, createSQLiteMemoryRepository } from 'cubicagentkit';

const client = new StdioAgentClient('npx', ['cubicler', '--server']);
const server = new StdioAgentServer();
const memory = await createSQLiteMemoryRepository('./memories.db');
const agent = new CubicAgent(client, server, memory);
```

## Development

- **Scripts**: `npm run build`, `npm test`, `npm run test:run`, `npm run lint`
- **TypeScript**: ES2023, ESNext modules, strict mode
- **Testing**: Vitest with mocks via `vi.fn()`, dependency injection for testability
- **Architecture**: Follow composition pattern, create interfaces, comprehensive tests, update `src/index.ts` exports

## Common Commands

```bash
npm test -- stdio           # Test specific files
npm run build              # Build and check types
npm run lint               # Run linter
```

Maintain consistency with established patterns and architecture.
