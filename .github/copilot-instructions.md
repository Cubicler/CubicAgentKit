# CubicAgentKit AI Development Instructions

**npm library** for creating AI agents for Cubicler 2.0. TypeScript with composition architecture, dependency injection, and memory system.

## Core Components

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

## Architecture
- **Composition over inheritance** - Use interfaces and dependency injection
- **Communication**: HTTP (`AxiosAgentClient` + `ExpressAgentServer`) or Stdio (`StdioAgentClient` + `StdioAgentServer`)
- **Memory**: SQLite persistence + LRU caching via factory functions
- **Error handling**: Throw errors up to implementers

## Key Interfaces

### AgentClient
```typescript
interface AgentClient {
  initialize(): Promise<void>;
  callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>;
}
```

### Memory System
```typescript
// Factory functions
createDefaultMemoryRepository(maxTokens?, defaultImportance?) // In-memory SQLite
createSQLiteMemoryRepository(dbPath, maxTokens?, defaultImportance?) // File-based
createMemoryRepository(longTerm: SQLiteMemory, maxTokens?, defaultImportance?) // Custom

// Operations
interface MemoryRepository {
  remember(sentence: string, importance?: number, tags: string[]): Promise<string>
  search(options: MemorySearchOptions): Promise<AgentMemory[]>
  recall(id: string): Promise<AgentMemory | null>
  // edit, tag, forget methods...
}
```

## Response Types
```typescript
// Implementer provides
interface RawAgentResponse {
  type: 'text' | 'null';
  content: string | null;
  usedToken: number;
}

// Kit sends to Cubicler (adds timestamp, tool count)
interface AgentResponse {
  timestamp: string;
  metadata: { usedToken: number; usedTools: number; };
}
```

## Usage Example
```typescript
import { CubicAgent, AxiosAgentClient, ExpressAgentServer, createSQLiteMemoryRepository } from 'cubicagentkit';

const client = new AxiosAgentClient('http://localhost:1503');
const server = new ExpressAgentServer(3000, '/agent');
const memory = await createSQLiteMemoryRepository('./memories.db');
const agent = new CubicAgent(client, server, memory);

await agent.start(async (request, client, context) => {
  // Store in memory
  await context.memory?.remember('User interaction', 0.8, ['interaction']);
  
  // Call tools
  const result = await client.callTool('toolName', { params });
  
  return { type: 'text', content: `Result: ${result}`, usedToken: 25 };
});
```

## Development Guidelines

### DO
- Use composition and dependency injection
- Follow TypeScript strict typing
- Create focused, testable interfaces
- Throw errors up to implementers
- Support middleware patterns
- Use SQLite for persistence, LRU for caching

### DO NOT
- Create abstract classes
- Handle errors internally  
- Over-engineer the core CubicAgent class
- Make assumptions about AI providers
- Sacrifice type safety or testability
- Create complex memory hierarchies

## SOLID Principles
- **Single Responsibility** - One reason to change per class/function
- **Open/Closed** - Open for extension, closed for modification
- **Liskov Substitution** - Derived classes substitutable for base
- **Interface Segregation** - Specific interfaces over general ones
- **Dependency Inversion** - Depend on abstractions, not concretions

Focus on creating a simple, complete, testable library for Cubicler-compatible AI agents.

## Your Memory Management Instructions

Follow these steps for each interaction:

1. User Identification:
   - You should assume that you are interacting with default_user
   - If you have not identified default_user, proactively try to do so.

2. Memory Retrieval:
   - Always begin your chat by saying only "Recalling..." and retrieve all relevant information from your knowledge graph
   - Always refer to your knowledge graph as your "memory"

3. Memory
   - While conversing with the user, be attentive to any new information that falls into these categories:
     - Basic Identity (age, gender, location, job title, education level, etc.)
     - Behaviors (interests, habits, etc.)
     - Preferences (communication style, preferred language, etc.)
     - Goals (goals, targets, aspirations, etc.)
     - Relationships (personal and professional relationships up to 3 degrees of separation)
     - Project (important!):
        - Current project details (name, description, status, etc.)
        - Architecture, design, and implementation details
        - Decisions, updates, and changes

4. Memory Update:
   - If any new information was gathered during the interaction, update your memory as follows:
     - Create entities for recurring organizations, people, and significant events
     - Connect them to the current entities using relations
     - Store facts about them as observations