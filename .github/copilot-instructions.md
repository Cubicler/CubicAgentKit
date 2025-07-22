# ⚙️ CubicAgent SDK Instructions

You're assisting with **CubicAgent SDK**, a TypeScript library for creating CubicAgent services that integrate with Cubicler AI orchestration framework.

## 🎯 Project Overview

**What it is:** A Node.js/Express library that implements the Cubicler Agent Integration API contract.
See [Cubicler](https://github.com/hainayanda/Cubicler/blob/main/README.md) for more details.

**Goal:** Allow developers to focus on AI logic rather than infrastructure concerns.

**Architecture:**
- Two integration approaches: Standalone agent or Express middleware
- TypeScript-first with dependency injection
- Built-in Cubicler communication and retry logic
- Comprehensive test suite with 68+ passing tests

## 📁 Current Structure

```text
cubic-agent-sdk/
├── src/
│   ├── agent/
│   │   ├── base-cubic-agent.ts      # Abstract base class
│   │   ├── cubic-agent.ts           # Standalone server agent
│   │   ├── cubic-agent-express.ts   # Express integration
│   │   └── cubicler-client.ts       # HTTP client with retry
│   ├── models/
│   │   ├── types.ts                 # Interfaces and types
│   │   └── definitions.ts           # Function definitions
│   └── utils/
│       └── logger.ts                # Structured logging
├── tests/                           # Complete test suite (68 tests)
└── dist/                           # Compiled output
```

## 🔌 API Contract

**Agent Endpoints:**
- `POST /call` - Main endpoint (AgentRequest → AgentResponse)
- `GET /health` - Health check

**Cubicler Communication:**
- `GET /provider/:providerName/spec` - Get provider specs
- `POST /execute/:functionName` - Execute provider functions

**Key Types:**
```typescript
interface AgentRequest {
  prompt: string;
  providers: ProviderInfo[];
  messages: Message[];
}

interface AgentResponse {
  message: string;
}
```

## � Usage Patterns

**Standalone Agent:**
```typescript
const agent = new CubicAgent({
  port: 3000,
  agentName: 'my-agent',
  cubiclerClient: new CubiclerClient('http://localhost:1503')
});

agent.onCall(async (request, context) => {
  const spec = await context.getProviderSpec('weather_api');
  const result = await context.executeFunction('getWeather', { city: 'London' });
  return `Weather: ${result.temperature}°C`;
});

agent.start();
```

**Express Integration:**
```typescript
const app = express();
const agent = new CubicAgentExpress(app, { 
  agentName: 'my-agent',
  cubiclerClient: cubiclerClient 
});
```

## ✅ Current Status

**Completed:**
- ✅ Modular architecture with separated classes
- ✅ TypeScript definitions and interfaces  
- ✅ Express integration (standalone + middleware)
- ✅ CubiclerClient with retry logic
- ✅ Comprehensive test suite (68 tests passing)
- ✅ Structured logging system
- ✅ Dependency injection for testing

**Architecture:**
- `BaseCubicAgent` - Abstract base with core functionality
- `CubicAgent` - Standalone agent with own server
- `CubicAgentExpress` - Express app integration
- `CubiclerClient` - HTTP client with automatic retries

## ✅ Your Role

When working with this CubicAgent SDK:
- Build clean, modular TypeScript following current patterns
- Use dependency injection for testability
- Follow the established project structure
- Write tests for new functionality
- Keep APIs simple and focused
- Maintain type safety throughout

## ✅ DO NOT

- Don't add AI model integrations (implementer's responsibility)
- Don't overcomplicate APIs
- Don't sacrifice type safety
- Don't add unnecessary dependencies
