# Stdio Agent Guide

Stdio (Standard Input/Output) agents implement the correct Cubicler stdio protocol where **Cubicler spawns your agent as a subprocess** and communicates via stdin/stdout. CubicAgentKit provides `StdioAgentClient` and `StdioAgentServer` that work with the existing `CubicAgent` class for a **uniform API** across all transports.

## Architecture Overview

In the correct stdio implementation:

1. **Cubicler spawns your agent** as a subprocess (e.g., `node my-agent.js`)
2. **Agent receives requests** from Cubicler via stdin using **JSON-RPC 2.0** (`dispatch` method)
3. **Agent can make MCP calls** back to Cubicler via stdout using **JSON-RPC 2.0** (`tools/call` method)
4. **Agent sends responses** to Cubicler via stdout using **JSON-RPC 2.0** responses

This follows the standard **JSON-RPC 2.0** protocol for bidirectional communication documented in the Cubicler integration guide.

## Uniform API Pattern

The same `CubicAgent` class works across **all transports** (HTTP, SSE, stdio):

```typescript
// HTTP Transport
const agent = new CubicAgent(
  new HttpAgentClient('http://localhost:1503'),
  new HttpAgentServer(3000, '/agent')
);

// Stdio Transport (same pattern!)
const agent = new CubicAgent(
  new StdioAgentClient(),
  new StdioAgentServer()
);

// Same fluent API for all transports
await agent
  .onMessage(messageHandler)
  .onTrigger(triggerHandler)
  .listen();
```

## Quick Start

### Basic Stdio Agent

Create an executable agent script:

```typescript
#!/usr/bin/env node
import { 
  CubicAgent, 
  StdioAgentClient, 
  StdioAgentServer,
  createSQLiteMemoryRepository 
} from '@cubicler/cubicagentkit';

// Create stdio client and server
const client = new StdioAgentClient();
const server = new StdioAgentServer();
const memory = await createSQLiteMemoryRepository('./memories.db');

// Create the agent using the uniform pattern
const agent = new CubicAgent(client, server, memory);

// Use the familiar builder API
await agent
  .onMessage(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    
    // Use memory
    await context.memory?.remember(`User asked: ${lastMessage.content}`, 0.8, ['conversation']);
    
    // Make MCP calls (automatically tracked in context.toolCallCount)
    if (lastMessage.content?.includes('weather')) {
      const weather = await client.callTool('weather_get_current', {
        city: 'Paris'
      });
      
      return {
        type: 'text',
        content: `Weather: ${weather.temperature}°C`,
        usedToken: 50
      };
    }
    
    return {
      type: 'text',
      content: `You said: ${lastMessage.content}`,
      usedToken: 25
    };
  })
  .onTrigger(async (request, client, context) => {
    const trigger = request.trigger;
    
    return {
      type: 'text',
      content: `Webhook ${trigger.name} triggered`,
      usedToken: 30
    };
  })
  .listen();

console.error('Stdio Agent started'); // Use stderr for logging
```

Make it executable and configure in Cubicler:

```bash
chmod +x my-agent.js
```

```json
{
  "agents": {
    "my_stdio_agent": {
      "name": "My Stdio Agent",
      "transport": "stdio",
      "command": "/path/to/my-agent.js",
      "description": "A simple stdio agent"
    }
  }
}
```

## StdioAgentClient

Handles MCP calls back to Cubicler via the stdio protocol.

### Constructor

```typescript
class StdioAgentClient implements AgentClient {
  constructor() // No parameters needed
}
```

### Key Features

- **No initialization** - Connection already established via Cubicler spawn
- **JSON-RPC 2.0 MCP calls** - Sends standardized JSON-RPC requests to Cubicler via stdout
- **Response handling** - Listens for JSON-RPC responses on stdin
- **Request correlation** - Uses incremental request IDs to match requests with responses
- **Silent logging** - Uses SilentLogger to avoid polluting stdout reserved for protocol

### Usage

```typescript
const client = new StdioAgentClient();

// No need to call initialize() - connection is already established
const weather = await client.callTool('weather_get_current', { city: 'Paris' });
```

## StdioAgentServer

Handles incoming requests from Cubicler and sends responses back.

### Constructor

```typescript
class StdioAgentServer implements AgentServer {
  constructor() // No parameters needed
}
```

### Key Features

- **Request handling** - Receives JSON-RPC 2.0 `dispatch` method calls from stdin
- **Response sending** - Sends JSON-RPC 2.0 responses to stdout
- **Line buffering** - Properly handles partial JSON messages
- **Error handling** - Graceful JSON-RPC error responses
- **Silent logging** - Uses SilentLogger to avoid polluting stdout reserved for protocol

### Usage

The server is automatically managed by `CubicAgent` - you don't interact with it directly.

## Complete Examples

### Weather Agent

```typescript
#!/usr/bin/env node
import { CubicAgent, StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';

const client = new StdioAgentClient();
const server = new StdioAgentServer();
const agent = new CubicAgent(client, server);

await agent
  .onMessage(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userInput = lastMessage.content || '';
    
    if (userInput.toLowerCase().includes('weather')) {
      try {
        // Extract city or use default
        const city = extractCity(userInput) || 'New York';
        const weather = await client.callTool('weather_get_current', { city });
        
        return {
          type: 'text',
          content: `🌤️ Weather in ${city}: ${weather.temperature}°C, ${weather.condition}`,
          usedToken: 40
        };
      } catch (error) {
        return {
          type: 'text',
          content: `❌ Sorry, couldn't get weather: ${error.message}`,
          usedToken: 25
        };
      }
    }
    
    return {
      type: 'text',
      content: `👋 Hello! Ask me about the weather. You said: "${userInput}"`,
      usedToken: 20
    };
  })
  .listen();

function extractCity(text: string): string | null {
  const match = text.match(/weather in ([a-zA-Z\s]+)/i);
  return match ? match[1].trim() : null;
}

console.error('Weather agent ready!');
```

### File Operations Agent

```typescript
#!/usr/bin/env node
import { CubicAgent, StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';

const client = new StdioAgentClient();
const server = new StdioAgentServer();
const agent = new CubicAgent(client, server);

await agent
  .onMessage(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userInput = lastMessage.content || '';
    
    // Parse command-style input
    const [command, ...args] = userInput.trim().split(' ');
    
    try {
      switch (command.toLowerCase()) {
        case 'ls':
        case 'list':
          const files = await client.callTool('filesystem_list_directory', {
            path: args[0] || '.'
          });
          return {
            type: 'text',
            content: `📁 Files:\n${files.map((f: any) => `  ${f.name}`).join('\n')}`,
            usedToken: 30
          };
          
        case 'read':
        case 'cat':
          if (!args[0]) {
            return {
              type: 'text',
              content: '❌ Usage: read <filename>',
              usedToken: 10
            };
          }
          
          const content = await client.callTool('filesystem_read_file', {
            path: args[0]
          });
          return {
            type: 'text',
            content: `📄 Content of ${args[0]}:\n\n${content}`,
            usedToken: 50
          };
          
        case 'help':
          return {
            type: 'text',
            content: `📋 Available commands:
  • list [path] - List files in directory
  • read <file> - Read file contents
  • help - Show this help`,
            usedToken: 20
          };
          
        default:
          return {
            type: 'text',
            content: `❓ Unknown command: ${command}. Type 'help' for available commands.`,
            usedToken: 15
          };
      }
    } catch (error) {
      return {
        type: 'text',
        content: `❌ Error: ${error.message}`,
        usedToken: 20
      };
    }
  })
  .listen();

console.error('File operations agent ready!');
```

### Multi-Tool Agent with Memory

```typescript
#!/usr/bin/env node
import { 
  CubicAgent, 
  StdioAgentClient, 
  StdioAgentServer,
  createSQLiteMemoryRepository 
} from '@cubicler/cubicagentkit';

async function main() {
  const client = new StdioAgentClient();
  const server = new StdioAgentServer();
  const memory = await createSQLiteMemoryRepository('./agent-memory.db');
  const agent = new CubicAgent(client, server, memory);

  await agent
    .onMessage(async (request, client, context) => {
      const lastMessage = request.messages[request.messages.length - 1];
      const userInput = lastMessage.content || '';

      // Remember this interaction
      await context.memory?.remember(
        `User: ${userInput}`,
        0.7,
        ['conversation', 'user-input']
      );

      // Handle different types of requests
      if (userInput.toLowerCase().includes('remember') || userInput.toLowerCase().includes('recall')) {
        const memories = await context.memory?.search({
          query: userInput,
          limit: 5
        });

        const memoryText = memories?.map(m => m.content).join('\n') || 'No memories found';
        
        return {
          type: 'text',
          content: `🧠 Here's what I remember:\n${memoryText}`,
          usedToken: 50
        };
      }

      if (userInput.toLowerCase().includes('weather')) {
        const city = extractCity(userInput) || 'New York';
        const weather = await client.callTool('weather_get_current', { city });
        
        await context.memory?.remember(
          `Weather in ${city}: ${JSON.stringify(weather)}`,
          0.8,
          ['weather', 'tool-result']
        );
        
        return {
          type: 'text',
          content: `🌤️ Weather in ${city}: ${weather.temperature}°C, ${weather.condition}`,
          usedToken: 40
        };
      }

      if (userInput.toLowerCase().includes('time')) {
        const time = await client.callTool('time_get_current', {});
        
        return {
          type: 'text',
          content: `⏰ Current time: ${time.formatted}`,
          usedToken: 25
        };
      }

      // Default response
      await context.memory?.remember(
        `Bot: Acknowledged user message`,
        0.5,
        ['conversation', 'bot-response']
      );

      return {
        type: 'text',
        content: `👋 Hello! I can help with weather, time, or remembering things. You said: "${userInput}"\n\n📊 I've made ${context.toolCallCount} tool calls so far.`,
        usedToken: 30
      };
    })
    .onTrigger(async (request, client, context) => {
      const trigger = request.trigger;
      
      // Remember trigger events
      await context.memory?.remember(
        `Webhook triggered: ${trigger.name}`,
        0.9,
        ['webhook', 'trigger']
      );

      return {
        type: 'text',
        content: `🔔 Webhook ${trigger.name} processed at ${trigger.triggeredAt}.\nPayload keys: ${Object.keys(trigger.payload || {}).join(', ')}`,
        usedToken: 25
      };
    })
    .listen();

  console.error('Multi-tool agent with memory ready!');
}

function extractCity(text: string): string | null {
  const match = text.match(/weather in ([a-zA-Z\s]+)/i);
  return match ? match[1].trim() : null;
}

main().catch((error) => {
  console.error('Agent startup error:', error);
  process.exit(1);
});
```

## Python Agent Example

You can also implement stdio agents in other languages:

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

class StdioPythonAgent:
    def __init__(self):
        self.next_request_id = 1

    def send_jsonrpc_message(self, message):
        json.dump(message, sys.stdout)
        sys.stdout.write('\n')
        sys.stdout.flush()

    def read_jsonrpc_message(self):
        line = sys.stdin.readline()
        return json.loads(line.strip())

    def call_mcp_tool(self, tool_name, arguments):
        request_id = self.next_request_id
        self.next_request_id += 1
        
        self.send_jsonrpc_message({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments}
        })
        
        # Wait for response
        while True:
            message = self.read_jsonrpc_message()
            if message.get("jsonrpc") == "2.0" and message.get("id") == request_id:
                if "error" in message:
                    raise Exception(f"JSON-RPC Error: {message['error']['message']}")
                return message.get("result")

    def run(self):
        # Read initial JSON-RPC dispatch request
        initial_message = self.read_jsonrpc_message()
        if initial_message.get("method") != "dispatch":
            raise ValueError(f"Expected dispatch method, got {initial_message.get('method')}")
        
        agent_data = initial_message["params"]
        messages = agent_data.get('messages', [])
        request_id = initial_message["id"]
        
        if messages:
            last_message = messages[-1]['content']
            
            if 'weather' in last_message.lower():
                try:
                    weather = self.call_mcp_tool('weather_get_current', {'city': 'London'})
                    content = f"🌤️ Weather: {weather}"
                    used_tools = 1
                except Exception as e:
                    content = f"❌ Weather error: {e}"
                    used_tools = 0
            else:
                content = f"👋 Echo: {last_message}"
                used_tools = 0
        else:
            content = "No messages received"
            used_tools = 0
        
        # Send JSON-RPC response
        self.send_jsonrpc_message({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "timestamp": datetime.now().isoformat(),
                "type": "text",
                "content": content,
                "metadata": {"usedToken": 30, "usedTools": used_tools}
            }
        })

if __name__ == "__main__":
    agent = StdioPythonAgent()
    agent.run()
```

## Message Protocol

### Input: JSON-RPC dispatch method

Your agent receives this from Cubicler via stdin using JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "dispatch",
  "params": {
    "agent": {
      "identifier": "my_agent",
      "name": "My Agent",
      "description": "Description",
      "prompt": "System prompt"
    },
    "tools": [
      {"name": "weather_get_current", "description": "Get current weather"}
    ],
    "servers": [
      {"identifier": "weather_service", "name": "Weather Service"}
    ],
    "messages": [
      {"sender": {"id": "user1"}, "type": "text", "content": "Hello"}
    ]
  }
}
```

### Output: JSON-RPC response

Your agent sends this to Cubicler via stdout:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "type": "text",
    "content": "Hello! How can I help?",
    "metadata": {
      "usedToken": 25,
      "usedTools": 0
    }
  }
}
```

### MCP Calls: JSON-RPC tools/call method

To call tools, send JSON-RPC request:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "weather_get_current",
    "arguments": {"city": "Paris"}
  }
}
```

Cubicler responds with JSON-RPC response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {"temperature": "22°C", "condition": "sunny"}
}
```

## Testing

### Unit Tests

The uniform pattern makes testing easier:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CubicAgent, StdioAgentClient, StdioAgentServer } from '@cubicler/cubicagentkit';

describe('Stdio Agent', () => {
  it('should handle requests like other transports', async () => {
    const mockClient = {
      initialize: vi.fn(),
      callTool: vi.fn().mockResolvedValue({ temperature: '20°C' })
    } as any;
    
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn()
    } as any;

    const agent = new CubicAgent(mockClient, mockServer);
    
    // Same API as HTTP/SSE agents
    const builder = agent.onMessage(async (request, client, context) => ({
      type: 'text',
      content: 'Test response',
      usedToken: 10
    }));

    expect(builder).toBeDefined();
  });
});
```

### Manual Testing

Test your agent manually with JSON-RPC 2.0:

```bash
# Create test input (JSON-RPC dispatch)
echo '{"jsonrpc":"2.0","id":1,"method":"dispatch","params":{"agent":{"identifier":"test","name":"Test","description":"Test","prompt":"Test"},"tools":[],"servers":[],"messages":[{"sender":{"id":"user"},"type":"text","content":"Hello"}]}}' | node my-agent.js
```

## Best Practices

### 1. Use stderr for logging

```typescript
console.error('Debug info'); // ✅ Goes to stderr
console.log('Debug info');   // ❌ Interferes with protocol
```

### 2. Handle errors gracefully

```typescript
await agent
  .onMessage(async (request, client, context) => {
    try {
      const result = await client.callTool('some_tool', {});
      return { type: 'text', content: `Success: ${result}`, usedToken: 30 };
    } catch (error) {
      console.error('Tool error:', error); // Log to stderr
      return { type: 'text', content: `Error: ${error.message}`, usedToken: 15 };
    }
  })
  .listen();
```

### 3. Make executables properly

```bash
#!/usr/bin/env node
# At the top of your script

chmod +x my-agent.js  # Make executable
```

### 4. Use memory for context

```typescript
const memory = await createSQLiteMemoryRepository('./memories.db');
const agent = new CubicAgent(client, server, memory);

await agent
  .onMessage(async (request, client, context) => {
    // Remember interactions
    await context.memory?.remember('User interaction', 0.8, ['conversation']);
    
    // Search relevant context
    const memories = await context.memory?.search({ query: userInput, limit: 3 });
    
    // Use memories in response...
  })
  .listen();
```

## Troubleshooting

### Common Issues

#### Agent not starting

- Check shebang line: `#!/usr/bin/env node`
- Verify executable permissions: `chmod +x my-agent.js`
- Ensure dependencies are installed: `npm install`

#### JSON parsing errors

- Only write protocol messages to stdout
- Use stderr for all logging: `console.error()`
- Test JSON output with: `echo 'input' | node agent.js | jq`

#### JSON-RPC timeouts

- Check JSON-RPC request/response ID matching
- Verify tool names match available tools
- Handle JSON-RPC errors gracefully

### Debugging

Add debugging to your agent:

```typescript
await agent
  .onMessage(async (request, client, context) => {
    console.error('📥 Received:', JSON.stringify(request, null, 2));
    
    const response = {
      type: 'text' as const,
      content: 'Debug response',
      usedToken: 10
    };
    
    console.error('📤 Sending:', JSON.stringify(response, null, 2));
    return response;
  })
  .listen();
```

The stderr output will be visible in Cubicler's logs without interfering with the stdio protocol.

## Benefits of Uniform Pattern

1. **✅ Consistency** - Same `CubicAgent` API across HTTP, SSE, and stdio
2. **✅ Familiarity** - Developers already know the pattern
3. **✅ Memory support** - Works with existing memory system
4. **✅ Tool tracking** - Automatic tracking via `CallContext`
5. **✅ Testability** - Easy to mock `AgentClient` and `AgentServer`
6. **✅ Flexibility** - Mix and match transports as needed

For memory usage in stdio agents, see [MEMORY_SYSTEM.md](MEMORY_SYSTEM.md).
