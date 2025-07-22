# CubicAgentKit

A TypeScript SDK for creating CubicAgents that integrate seamlessly with the Cubicler AI orchestration framework.

## Overview

CubicAgentKit simplifies building **CubicAgent** services for the Cubicler AI orchestration framework. The SDK provides a clean, modular TypeScript library that abstracts the complexity of Cubicler's Agent Integration API contract, allowing developers to focus on AI logic rather than infrastructure concerns.

The SDK provides two flexible integration approaches:

1. **Standalone Agent**: Creates and manages its own Express server
2. **Express Integration**: Integrates with existing Express applications

## Installation

```bash
npm install @cubicler/cubicagentkit
```

## Key Features

- 🚀 **Two integration approaches**: Standalone server or Express middleware
- 🔧 **Dependency injection**: Injectable CubiclerClient for easy testing and mocking
- 📝 **Full TypeScript support**: Complete type safety and IntelliSense
- 🔄 **Automatic retries**: Built-in retry logic with exponential backoff for Cubicler communication
- 🪵 **Structured logging**: Configurable logging levels with timestamps
- ✅ **Testing friendly**: Comprehensive test suite with easy mocking support
- 🏗️ **Clean architecture**: Modular design with separation of concerns
- 📦 **Contract compliance**: Implements exact Cubicler Agent Integration API contract

## Quick Start

### 1. Standalone Agent

```typescript
import { CubicAgent, CubiclerClient } from '@cubicler/cubicagentkit';

// Create Cubicler client
const cubiclerClient = new CubiclerClient(
  'http://localhost:1503',
  10000,  // timeout in ms
  3       // retry attempts
);

// Create standalone agent
const agent = new CubicAgent({
  port: 3000,
  agentName: 'my-weather-agent',
  logLevel: 'info',
  cubiclerClient: cubiclerClient
});

// Define agent behavior
agent.onCall(async (request, context) => {
  const { prompt, providers, messages } = request;
  
  // Get provider specifications and context
  if (providers.some(p => p.name === 'weather_api')) {
    const weatherSpec = await context.getProviderSpec('weather_api');
    console.log('Weather context:', weatherSpec.context);
    console.log('Available functions:', weatherSpec.functions);
    
    // Execute function through Cubicler
    const weather = await context.executeFunction('getWeather', { 
      city: 'London',
      country: 'UK'
    });
    
    return `The weather in London is ${weather.conditions} with ${weather.temperature}°C`;
  }
  
  return 'Hello from my CubicAgent!';
});

// Start the agent
agent.start(() => {
  console.log('Weather Agent is running on port 3000');
});
```

### 2. Express Integration

```typescript
import express from 'express';
import { CubicAgentExpress, CubiclerClient } from '@cubicler/cubicagentkit';

// Create Express app
const app = express();
app.use(express.json());

// Your custom routes
app.get('/custom', (req, res) => {
  res.json({ message: 'Custom endpoint' });
});

// Create Cubicler client
const cubiclerClient = new CubiclerClient(
  'http://localhost:1503',
  10000,  // timeout in ms
  3       // retry attempts
);

// Integrate CubicAgent
const agent = new CubicAgentExpress(app, {
  agentName: 'my-integrated-agent',
  logLevel: 'info',
  cubiclerClient: cubiclerClient
});

agent.onCall(async (request, context) => {
  const { prompt, providers, messages } = request;
  
  // Your agent logic here - same as standalone agent
  // The SDK handles the Cubicler integration automatically
  return 'Response from integrated agent';
});

// Start Express server
app.listen(3000, () => {
  console.log('Express app with CubicAgent running on port 3000');
});
```

## Project Structure

```text
cubic-agent-sdk/
├── src/
│   ├── index.ts              # Main exports
│   ├── agent/                # Agent implementations
│   │   ├── base-cubic-agent.ts     # Abstract base class
│   │   ├── cubic-agent.ts          # Standalone agent
│   │   ├── cubic-agent-express.ts  # Express integration
│   │   └── cubicler-client.ts      # Cubicler API client
│   ├── models/               # Type definitions
│   │   ├── types.ts          # Main interfaces and types
│   │   └── definitions.ts    # Function and provider definitions
│   └── utils/                # Utilities
│       └── logger.ts         # Structured logging
├── tests/                    # Test suite (mirrors src structure)
│   ├── agent/                # Agent tests
│   └── utils/                # Utility tests
├── dist/                     # Compiled JavaScript
└── examples/                 # Example implementations
```

## Agent Integration Contract

The SDK implements the exact Cubicler Agent Integration contract:

### Required Endpoints

- `POST /call` - Receives `AgentRequest`, returns `AgentResponse`
- `GET /health` - Health check endpoint

### Cubicler Communication

- `GET /provider/:providerName/spec` - Get provider specs and context
- `POST /execute/:functionName` - Execute functions through providers

### Request/Response Format

**AgentRequest:**

```typescript
{
  prompt: string;           // System prompt with agent instructions
  providers: Provider[];    // Available providers with descriptions
  messages: Message[];      // Conversation history
}
```

**AgentResponse:**

```typescript
{
  message: string;          // Agent's response message
}
```

## API Reference

### CubicAgent

Standalone agent that manages its own Express server.

**Constructor:**

```typescript
new CubicAgent(config: AgentConfig)
```

**AgentConfig:**

- `port: number` - Port to run the server on
- `agentName: string` - Name of your agent
- `cubiclerClient: ICubiclerClient` - Client for Cubicler communication
- `logLevel?: LogLevel` - Logging level ('debug' | 'info' | 'warn' | 'error', default: 'info')

**Methods:**

- `onCall(handler: CallHandler): void` - Register request handler
- `start(callback?: () => void): void` - Start the server
- `stop(): void` - Stop the server
- `getApp(): Express` - Get Express app instance for custom routes

### CubicAgentExpress

Agent wrapper for existing Express applications.

**Constructor:**

```typescript
new CubicAgentExpress(app: Express, options: CubicAgentOptions)
```

**CubicAgentOptions:**

- `agentName: string` - Name of your agent
- `cubiclerClient: ICubiclerClient` - Client for Cubicler communication
- `logLevel?: LogLevel` - Logging level ('debug' | 'info' | 'warn' | 'error', default: 'info')

**Methods:**

- `onCall(handler: CallHandler): void` - Register request handler
- `getApp(): Express` - Get Express app instance

### CubiclerClient

HTTP client for communicating with Cubicler with automatic retry logic.

**Constructor:**

```typescript
new CubiclerClient(
  cubiclerEndpoint: string,
  timeout?: number = 30000,
  retryAttempts?: number = 3
)
```

**Parameters:**

- `cubiclerEndpoint: string` - Cubicler server endpoint (e.g., `http://localhost:1503`)
- `timeout?: number` - Request timeout in milliseconds (default: 30000)
- `retryAttempts?: number` - Number of retry attempts (default: 3)

**Methods:**

- `getProviderSpec(providerName: string): Promise<ProviderSpecResponse>` - Get provider specification
- `executeFunction(functionName: string, parameters: JSONObject): Promise<FunctionCallResult>` - Execute provider function

### CallHandler

The function that processes agent requests:

```typescript
type CallHandler = (request: AgentRequest, context: CallContext) => Promise<string>;
```

**AgentRequest:**

- `prompt: string` - The user's prompt
- `providers: Provider[]` - Available providers
- `messages: Message[]` - Conversation history

**CallContext:**

- `getProviderSpec(providerName: string): Promise<ProviderSpecResponse>` - Get provider specification and context
- `executeFunction(functionName: string, parameters: JSONObject): Promise<FunctionCallResult>` - Execute provider function

## Testing

The SDK comes with a comprehensive test suite covering all major components:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

### Test Structure

The test suite mirrors the source structure for easy navigation:

```text
tests/
├── agent/                    # Agent implementation tests
│   ├── base-cubic-agent.test.ts
│   ├── cubic-agent.test.ts
│   ├── cubic-agent-express.test.ts
│   └── cubicler-client.test.ts
├── models/                   # Type and interface tests
│   └── types.test.ts
└── utils/                    # Utility tests
    └── logger.test.ts
```

### Mocking

The SDK is designed for easy testing with dependency injection:

```typescript
// Example test setup
import { CubicAgent } from 'cubic-agent-sdk';

class MockCubiclerClient implements ICubiclerClient {
  async getProviderSpec(providerName: string): Promise<ProviderSpecResponse> {
    return {
      context: `Mock context for ${providerName}`,
      functions: [/* mock functions */]
    };
  }

  async executeFunction(functionName: string, parameters: any): Promise<any> {
    return { result: `Mock result for ${functionName}` };
  }
}

const mockClient = new MockCubiclerClient();
const agent = new CubicAgent({
  port: 3000,
  agentName: 'test-agent',
  cubiclerClient: mockClient
});
```

## Development

### Building

```bash
# Build the project
npm run build

# Build in watch mode for development
npm run dev
```

### Project Scripts

```bash
npm run build          # Compile TypeScript to JavaScript
npm run dev            # Build in watch mode
npm run start          # Run the compiled JavaScript
npm run test           # Run test suite
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run prepublishOnly # Pre-publish build step
```

## Endpoints

Every CubicAgent automatically exposes these endpoints:

- `GET /health` - Health check endpoint returning agent status
- `POST /call` - Main agent call endpoint implementing Cubicler contract

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests: `npm test`
4. Build the project: `npm run build`
5. Submit a pull request

### Development Workflow

```bash
# Clone and setup
git clone https://github.com/hainayanda/CubicAgentKit.git
cd CubicAgentKit
npm install

# Development
npm run dev        # Watch mode
npm test          # Run tests
npm run test:watch # Test watch mode

# Before committing
npm run build     # Ensure build works
npm test          # Ensure all tests pass
```

## License

Apache-2.0 License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: This README and inline code documentation
- **Examples**: Check the `examples/` directory for sample implementations
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Testing**: Comprehensive test suite for reliability
