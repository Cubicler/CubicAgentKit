# Stdio Agent Guide

Stdio (Standard Input/Output) agents provide CLI-based communication, perfect for command-line tools, local development, and desktop applications. They communicate via stdin/stdout streams instead of HTTP.

## Quick Start

```typescript
import { 
  CubicAgent, 
  StdioAgentClient, 
  StdioAgentServer,
  createSQLiteMemoryRepository 
} from '@cubicler/cubicagentkit';

// Create stdio components
const client = new StdioAgentClient('npx', ['cubicler', '--server']);
const server = new StdioAgentServer();
const memory = await createSQLiteMemoryRepository('./memories.db');
const agent = new CubicAgent(client, server, memory);

// Start agent
await agent.start(async (request, client, context) => {
  const lastMessage = request.messages[request.messages.length - 1];
  
  if (lastMessage.content?.includes('weather')) {
    const weatherData = await client.callTool('weatherService_getCurrentWeather', {
      city: 'Paris'
    });
    return {
      type: 'text',
      content: `The weather is ${weatherData.temperature}°C`,
      usedToken: 50
    };
  }
  
  return {
    type: 'text',
    content: `Processing: ${lastMessage.content}`,
    usedToken: 20
  };
});

console.log('📱 Stdio Agent started');
```

## StdioAgentClient

Client that communicates with Cubicler via stdio, typically used for spawning Cubicler as a subprocess.

### Constructor

```typescript
class StdioAgentClient implements AgentClient {
  constructor(command: string, args?: string[])
}
```

**Parameters:**

- `command`: Command to execute (e.g., 'npx', 'cubicler', 'node')
- `args`: Command arguments (e.g., ['cubicler', '--server', '--stdio'])

### Methods

```typescript
// Initialize the subprocess and stdio communication
async initialize(): Promise<void>

// Call a tool via stdio JSON-RPC
async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>
```

### Example Usage

```typescript
// Using npx to start Cubicler
const client = new StdioAgentClient('npx', ['cubicler', '--server', '--stdio']);

// Using direct binary
const client = new StdioAgentClient('/usr/local/bin/cubicler', ['--server', '--stdio']);

// Using Node.js script
const client = new StdioAgentClient('node', ['./cubicler-server.js', '--stdio']);

// Call tools
await client.initialize();
const result = await client.callTool('filesystem_readFile', {
  path: './config.json'
});
```

## StdioAgentServer

Server that handles incoming requests via stdin and responds via stdout.

### Constructor

```typescript
class StdioAgentServer implements AgentServer {
  constructor()
}
```

### Methods

```typescript
// Start listening for stdin messages
async start(handler: RequestHandler): Promise<void>

// Stop the stdio server
async stop(): Promise<void>
```

### Example Usage

```typescript
const server = new StdioAgentServer();

await server.start(async (request, client, context) => {
  // Handle the request
  const lastMessage = request.messages[request.messages.length - 1];
  
  return {
    type: 'text',
    content: `Received: ${lastMessage.content}`,
    usedToken: 15
  };
});
```

## Use Cases

### Command Line Tools

Perfect for building CLI utilities that integrate with Cubicler:

```typescript
#!/usr/bin/env node

import { CubicAgent, StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';

async function createCLITool() {
  const client = new StdioAgentClient('cubicler', ['--server', '--stdio']);
  const server = new StdioAgentServer();
  const agent = new CubicAgent(client, server);

  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userInput = lastMessage.content || '';
    
    // Parse CLI-style commands
    const [command, ...args] = userInput.trim().split(' ');
    
    switch (command) {
      case 'list':
        const files = await client.callTool('filesystem_listDirectory', {
          path: args[0] || '.'
        });
        return {
          type: 'text',
          content: `Files:\n${files.map(f => `  ${f.name}`).join('\n')}`,
          usedToken: 30
        };
        
      case 'read':
        const content = await client.callTool('filesystem_readFile', {
          path: args[0]
        });
        return {
          type: 'text',
          content: `File content:\n${content}`,
          usedToken: 50
        };
        
      default:
        return {
          type: 'text',
          content: `Unknown command: ${command}. Available: list, read`,
          usedToken: 10
        };
    }
  });
}

if (require.main === module) {
  createCLITool().catch(console.error);
}
```

### Desktop Applications

Integrate with desktop apps via stdio:

```typescript
import { CubicAgent, StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';
import * as path from 'path';

async function createDesktopAgent() {
  // Assume Cubicler is bundled with the desktop app
  const cubiclerPath = path.join(__dirname, '../bin/cubicler');
  const client = new StdioAgentClient(cubiclerPath, ['--server', '--stdio']);
  const server = new StdioAgentServer();
  
  const agent = new CubicAgent(client, server);

  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userMessage = lastMessage.content || '';
    
    // Handle desktop-specific operations
    if (userMessage.includes('screenshot')) {
      const screenshot = await client.callTool('system_takeScreenshot', {});
      return {
        type: 'text',
        content: `Screenshot saved to: ${screenshot.path}`,
        usedToken: 25
      };
    }
    
    if (userMessage.includes('notification')) {
      await client.callTool('system_showNotification', {
        title: 'Agent Notification',
        message: userMessage.replace('notification ', '')
      });
      return {
        type: 'text',
        content: 'Notification sent!',
        usedToken: 15
      };
    }
    
    return {
      type: 'text',
      content: 'Hello from desktop agent!',
      usedToken: 10
    };
  });
}
```

### Development and Testing

Great for local development and testing:

```typescript
import { CubicAgent, StdioAgentClient, StdioAgentServer, createDefaultMemoryRepository } from '@cubicler/cubicagentkit';

async function createDevAgent() {
  // Use local Cubicler instance
  const client = new StdioAgentClient('npm', ['run', 'cubicler:dev', '--', '--stdio']);
  const server = new StdioAgentServer();
  const memory = await createDefaultMemoryRepository();
  
  const agent = new CubicAgent(client, server, memory);

  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    
    // Debug logging
    console.error(`[DEBUG] Received: ${lastMessage.content}`);
    console.error(`[DEBUG] Tool calls so far: ${context.toolCallCount}`);
    
    // Simulate different scenarios for testing
    if (lastMessage.content?.includes('test error')) {
      throw new Error('Simulated error for testing');
    }
    
    if (lastMessage.content?.includes('test memory')) {
      await context.memory?.remember('Test memory entry', 0.8, ['test']);
      const memories = await context.memory?.search({ tags: ['test'] });
      return {
        type: 'text',
        content: `Memory test: ${memories?.length} entries found`,
        usedToken: 25
      };
    }
    
    return {
      type: 'text',
      content: 'Development agent is working!',
      usedToken: 15
    };
  });
}

if (process.env.NODE_ENV === 'development') {
  createDevAgent().catch(console.error);
}
```

## Configuration Examples

### Environment-Based Configuration

```typescript
import { StdioAgentClient } from '@cubicler/cubicagentkit';

function createClient() {
  if (process.env.CUBICLER_BINARY) {
    // Use specific binary
    return new StdioAgentClient(process.env.CUBICLER_BINARY, ['--stdio']);
  }
  
  if (process.env.NODE_ENV === 'development') {
    // Development setup
    return new StdioAgentClient('npm', ['run', 'cubicler:dev', '--', '--stdio']);
  }
  
  // Production setup
  return new StdioAgentClient('npx', ['@cubicler/cli', '--server', '--stdio']);
}

const client = createClient();
```

### Custom Process Management

```typescript
import { spawn } from 'child_process';
import { StdioAgentClient } from '@cubicler/cubicagentkit';

class CustomStdioClient extends StdioAgentClient {
  constructor() {
    // Start with custom environment and options
    super('cubicler', ['--server', '--stdio'], {
      env: {
        ...process.env,
        CUBICLER_CONFIG: './custom-config.json',
        LOG_LEVEL: 'debug'
      },
      cwd: '/path/to/working/directory'
    });
  }
}

const client = new CustomStdioClient();
```

## Error Handling

```typescript
await agent.start(async (request, client, context) => {
  try {
    const result = await client.callTool('someService_someTool', { param: 'value' });
    return {
      type: 'text',
      content: `Success: ${JSON.stringify(result)}`,
      usedToken: 30
    };
  } catch (error) {
    console.error('Stdio Agent error:', error);
    
    // Handle stdio-specific errors
    if (error.message.includes('EPIPE')) {
      console.error('Subprocess pipe closed unexpectedly');
      return {
        type: 'text',
        content: 'Communication error with Cubicler subprocess.',
        usedToken: 15
      };
    }
    
    if (error.message.includes('ENOENT')) {
      console.error('Cubicler binary not found');
      return {
        type: 'text',
        content: 'Cubicler not installed or not in PATH.',
        usedToken: 15
      };
    }
    
    return {
      type: 'text',
      content: `Error: ${error.message}`,
      usedToken: 15
    };
  }
});
```

## Process Lifecycle Management

### Graceful Startup

```typescript
import { CubicAgent, StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';

async function startWithRetry() {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const client = new StdioAgentClient('cubicler', ['--server', '--stdio']);
      const server = new StdioAgentServer();
      const agent = new CubicAgent(client, server);
      
      await agent.start(async (request, client, context) => {
        // Your handler logic
        return { type: 'text', content: 'OK', usedToken: 5 };
      });
      
      console.log('Stdio agent started successfully');
      break;
    } catch (error) {
      retries++;
      console.error(`Failed to start (attempt ${retries}):`, error.message);
      
      if (retries >= maxRetries) {
        console.error('Max retries exceeded, exiting');
        process.exit(1);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

startWithRetry();
```

### Graceful Shutdown

```typescript
let agent: CubicAgent | null = null;

async function startAgent() {
  const client = new StdioAgentClient('cubicler', ['--server', '--stdio']);
  const server = new StdioAgentServer();
  agent = new CubicAgent(client, server);

  await agent.start(async (request, client, context) => {
    // Your handler logic
    return { type: 'text', content: 'Processing...', usedToken: 10 };
  });
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (agent) {
    await agent.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (agent) {
    await agent.stop();
  }
  process.exit(0);
});

startAgent().catch(console.error);
```

## Testing

### Unit Testing

```typescript
import { StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('StdioAgent', () => {
  let client: StdioAgentClient;
  let server: StdioAgentServer;
  
  beforeEach(async () => {
    client = new StdioAgentClient('node', ['./test/mock-cubicler.js']);
    server = new StdioAgentServer();
    await client.initialize();
  });
  
  afterEach(async () => {
    await client.stop();
    await server.stop();
  });
  
  it('should handle tool calls', async () => {
    const result = await client.callTool('test_echo', { message: 'hello' });
    expect(result).toEqual({ message: 'hello' });
  });
  
  it('should process requests', async () => {
    const response = await new Promise((resolve) => {
      server.start(async (request, client, context) => {
        resolve({
          type: 'text',
          content: 'Test response',
          usedToken: 10
        });
        return {
          type: 'text',
          content: 'Test response',
          usedToken: 10
        };
      });
      
      // Send test request to server
      // Implementation depends on your test setup
    });
    
    expect(response).toBeDefined();
  });
});
```

### Integration Testing

```typescript
// test/integration/stdio-agent.test.ts
import { CubicAgent, StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';
import { spawn } from 'child_process';

describe('Stdio Agent Integration', () => {
  it('should integrate with real Cubicler instance', async () => {
    // Start real Cubicler process for testing
    const cubiclerProcess = spawn('cubicler', ['--server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    try {
      const client = new StdioAgentClient(cubiclerProcess.command, cubiclerProcess.args);
      const server = new StdioAgentServer();
      const agent = new CubicAgent(client, server);
      
      let responseReceived = false;
      
      await agent.start(async (request, client, context) => {
        responseReceived = true;
        return {
          type: 'text',
          content: 'Integration test response',
          usedToken: 10
        };
      });
      
      // Simulate receiving a request
      // This would typically come from Cubicler
      setTimeout(() => {
        expect(responseReceived).toBe(true);
      }, 1000);
      
    } finally {
      cubiclerProcess.kill();
    }
  }, 10000);
});
```

## Best Practices

1. **Process Management**: Handle subprocess lifecycle properly
2. **Error Handling**: Catch stdio-specific errors (EPIPE, ENOENT)
3. **Resource Cleanup**: Always close processes and streams
4. **Path Configuration**: Use absolute paths when possible
5. **Environment Variables**: Configure via environment for flexibility
6. **Logging**: Log to stderr to avoid interfering with stdio communication

## Common Patterns

### CLI Tool Pattern

```bash
#!/usr/bin/env node
# my-agent-cli

npx my-agent-package --stdio
```

### Desktop App Integration

```javascript
// In Electron main process
const { spawn } = require('child_process');
const path = require('path');

const agentProcess = spawn('node', [
  path.join(__dirname, 'stdio-agent.js')
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle agent communication
agentProcess.stdout.on('data', (data) => {
  // Process agent responses
});
```

## Troubleshooting

### Common Issues

**Subprocess Not Found**

```
Error: spawn cubicler ENOENT
```

- Ensure Cubicler is installed and in PATH
- Use absolute paths if needed
- Check execute permissions

**Broken Pipe Errors**

```
Error: write EPIPE
```

- Subprocess terminated unexpectedly
- Check subprocess logs for errors
- Implement process restart logic

**JSON Parse Errors**

```
Error: Unexpected token in JSON
```

- Mixing stderr output with stdio communication
- Ensure clean JSON-RPC protocol on stdin/stdout
- Redirect other output to stderr

### Debugging

Enable debug logging:

```typescript
const client = new StdioAgentClient('cubicler', ['--server', '--stdio', '--debug']);

// Monitor subprocess stderr for debugging
client.process.stderr?.on('data', (data) => {
  console.error(`Cubicler: ${data}`);
});
```

For memory usage in CLI contexts, see [MEMORY_SYSTEM.md](MEMORY_SYSTEM.md).
