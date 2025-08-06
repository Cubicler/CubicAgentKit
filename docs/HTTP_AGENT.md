# HTTP Agent Guide

HTTP-based agents are the most common deployment pattern for CubicAgentKit. They provide a traditional server-client architecture where your agent hosts an HTTP server and communicates with Cubicler via HTTP client requests.

## Quick Start

```typescript
import { 
  CubicAgent, 
  HttpAgentClient, 
  HttpAgentServer,
  createDefaultMemoryRepository
} from '@cubicler/cubicagentkit';

// Create client, server, and memory system
const client = new HttpAgentClient('http://localhost:1503');
const server = new HttpAgentServer(3000, '/agent');
const memory = await createDefaultMemoryRepository();
const agent = new CubicAgent(client, server, memory);

// Start agent with dispatch handler
await agent.start(async (request, client, context) => {
  const lastMessage = request.messages[request.messages.length - 1];
  
  // Call Cubicler tools
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
    content: `Hello! You said: ${lastMessage.content}`,
    usedToken: 25
  };
});

console.log('✅ Agent running on http://localhost:3000/agent');
```

## HttpAgentClient

HTTP client for communicating with Cubicler's MCP protocol.

### Constructor

```typescript
class HttpAgentClient implements AgentClient {
  constructor(url: string, timeout?: number, jwtConfig?: JWTAuthConfig)
}
```

**Parameters:**

- `url`: Cubicler server URL (e.g., '<http://localhost:1503>')
- `timeout`: Request timeout in milliseconds (default: 30000)
- `jwtConfig`: Optional JWT authentication configuration

### Methods

```typescript
// Add JWT authentication after instantiation
useJWTAuth(jwtConfig: JWTAuthConfig): this

// Initialize the client (called automatically)
async initialize(): Promise<void>

// Call a tool on Cubicler
async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>
```

### Example Usage

```typescript
// Basic client
const client = new HttpAgentClient('http://localhost:1503');

// With timeout
const client = new HttpAgentClient('http://localhost:1503', 60000);

// With JWT authentication
const client = new HttpAgentClient('http://localhost:1503')
  .useJWTAuth({
    type: 'static',
    token: 'your-jwt-token'
  });

// Call tools
const result = await client.callTool('weatherService_getCurrentWeather', {
  city: 'London',
  country: 'UK'
});
```

## HttpAgentServer

HTTP server for handling agent requests from Cubicler.

### Constructor

```typescript
class HttpAgentServer implements AgentServer {
  constructor(port: number, endpoint?: string, jwtConfig?: JWTMiddlewareConfig)
}
```

**Parameters:**

- `port`: Port to listen on (e.g., 3000)
- `endpoint`: Endpoint path (default: '/agent')
- `jwtConfig`: Optional JWT middleware configuration

### Methods

```typescript
// Add JWT authentication middleware
useJWTAuth(jwtConfig: JWTMiddlewareConfig, optional?: boolean): this

// Start the server
async start(handler: RequestHandler): Promise<void>

// Stop the server
async stop(): Promise<void>
```

### Example Usage

```typescript
// Basic server
const server = new HttpAgentServer(3000);

// Custom endpoint
const server = new HttpAgentServer(3000, '/my-agent');

// With JWT validation
const server = new HttpAgentServer(3000, '/agent')
  .useJWTAuth({
    verification: {
      secret: 'your-secret',
      algorithms: ['HS256']
    }
  });

// Optional JWT (allows requests with or without JWT)
const server = new HttpAgentServer(3000, '/agent')
  .useJWTAuth(jwtConfig, true);
```

## Complete Example with Memory

```typescript
import { 
  CubicAgent, 
  HttpAgentClient, 
  HttpAgentServer,
  createSQLiteMemoryRepository
} from '@cubicler/cubicagentkit';

async function startWeatherAgent() {
  // Setup components
  const client = new HttpAgentClient('http://localhost:1503');
  const server = new HttpAgentServer(3000, '/weather-agent');
  const memory = await createSQLiteMemoryRepository('./weather-memories.db');
  
  const agent = new CubicAgent(client, server, memory);
  
  // Start agent with comprehensive handler
  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userMessage = lastMessage.content || '';
    
    // Remember user interactions
    await context.memory?.remember(
      `User said: ${userMessage}`,
      0.5,
      ['interaction', 'user_input']
    );
    
    // Handle weather requests
    if (userMessage.toLowerCase().includes('weather')) {
      // Extract city from message (simple approach)
      const cityMatch = userMessage.match(/weather in (\w+)/i);
      const city = cityMatch ? cityMatch[1] : 'London';
      
      try {
        const weather = await client.callTool('weatherService_getCurrentWeather', {
          city,
          units: 'metric'
        });
        
        // Remember weather data
        await context.memory?.remember(
          `Weather in ${city}: ${weather.temperature}°C, ${weather.description}`,
          0.8,
          ['weather', 'data', city.toLowerCase()]
        );
        
        return {
          type: 'text',
          content: `Weather in ${city}: ${weather.temperature}°C, ${weather.description}`,
          usedToken: 75
        };
      } catch (error) {
        return {
          type: 'text',
          content: `Sorry, I couldn't get weather data for ${city}. Error: ${error.message}`,
          usedToken: 25
        };
      }
    }
    
    // Search memories for context
    const memories = await context.memory?.search({
      content: userMessage.toLowerCase(),
      limit: 3
    });
    
    let response = "Hello! I'm a weather assistant.";
    if (memories && memories.length > 0) {
      response += ` I remember you previously asked about: ${memories[0].sentence}`;
    }
    response += " Ask me about the weather in any city!";
    
    return {
      type: 'text',
      content: response,
      usedToken: 35
    };
  });
  
  console.log('🌤️ Weather Agent running on http://localhost:3000/weather-agent');
}

startWeatherAgent().catch(console.error);
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
    console.error('Tool call failed:', error);
    
    // Handle specific errors
    if (error.message.includes('timeout')) {
      return {
        type: 'text',
        content: 'Request timed out. Please try again.',
        usedToken: 15
      };
    }
    
    if (error.message.includes('authentication')) {
      return {
        type: 'text',
        content: 'Authentication failed. Please check your credentials.',
        usedToken: 15
      };
    }
    
    return {
      type: 'text',
      content: 'An error occurred while processing your request.',
      usedToken: 15
    };
  }
});
```

## Deployment Considerations

### Production Setup

```typescript
import { HttpAgentClient, HttpAgentServer } from '@cubicler/cubicagentkit';

// Production configuration
const client = new HttpAgentClient(
  process.env.CUBICLER_URL || 'http://localhost:1503',
  parseInt(process.env.REQUEST_TIMEOUT || '30000')
);

const server = new HttpAgentServer(
  parseInt(process.env.PORT || '3000'),
  process.env.AGENT_ENDPOINT || '/agent'
);

// Add authentication in production
if (process.env.JWT_SECRET) {
  server.useJWTAuth({
    verification: {
      secret: process.env.JWT_SECRET,
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER
    }
  });
}
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Load Balancing

HTTP agents can be easily load-balanced since they're stateless:

```typescript
// Agent instance 1
const server1 = new HttpAgentServer(3001, '/agent');

// Agent instance 2  
const server2 = new HttpAgentServer(3002, '/agent');

// Use a load balancer (nginx, HAProxy, etc.) to distribute traffic
```

## Best Practices

1. **Error Handling**: Always wrap tool calls in try-catch blocks
2. **Timeouts**: Set appropriate timeouts for your use case
3. **Memory Usage**: Use memory judiciously to avoid performance issues
4. **Security**: Always use HTTPS in production
5. **Monitoring**: Log important events and errors
6. **Graceful Shutdown**: Implement proper cleanup

```typescript
// Graceful shutdown example
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await agent.stop();
  process.exit(0);
});
```

## Troubleshooting

### Common Issues

**Connection Refused**

```
Error: connect ECONNREFUSED 127.0.0.1:1503
```

- Ensure Cubicler is running and accessible
- Check the URL and port configuration

**Port Already in Use**

```
Error: listen EADDRINUSE: address already in use :::3000
```

- Choose a different port or stop the conflicting process

**Authentication Errors**

```
Error: 401 Unauthorized
```

- Verify JWT configuration and token validity
- Check that Cubicler expects the authentication method you're using

For more advanced authentication patterns, see [JWT_AUTH.md](JWT_AUTH.md).
For memory system usage, see [MEMORY_SYSTEM.md](MEMORY_SYSTEM.md).
