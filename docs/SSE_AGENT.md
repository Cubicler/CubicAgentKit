# SSE Agent Guide

Server-Sent Events (SSE) agents provide real-time, push-based communication with Cubicler. Unlike HTTP agents that host their own server, SSE agents connect to Cubicler's SSE endpoint and receive requests as server-sent events.

## Quick Start

```typescript
import { 
  CubicAgent, 
  HttpAgentClient, 
  SSEAgentServer,
  createDefaultMemoryRepository 
} from '@cubicler/cubicagentkit';

// Create client, SSE server, and memory system
const client = new HttpAgentClient('http://localhost:1503');
const server = new SSEAgentServer('http://localhost:8080', 'my-agent-id');
const memory = await createDefaultMemoryRepository();
const agent = new CubicAgent(client, server, memory);

// Start agent - same handler as HTTP version!
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
    content: `Hello! You said: ${lastMessage.content}`,
    usedToken: 25
  };
});

console.log('⚡ SSE Agent connected to Cubicler');
```

## SSEAgentServer

Server-Sent Events client that connects to Cubicler instead of hosting its own server.

### Constructor

```typescript
class SSEAgentServer implements AgentServer {
  constructor(
    cubiclerUrl: string, 
    agentId: string, 
    timeout?: number, 
    jwtConfig?: JWTAuthConfig
  )
}
```

**Parameters:**

- `cubiclerUrl`: Cubicler's SSE endpoint URL (e.g., '<http://localhost:8080>')
- `agentId`: Unique identifier for your agent
- `timeout`: Connection timeout in milliseconds (default: 30000)
- `jwtConfig`: Optional JWT authentication configuration

### Methods

```typescript
// Add JWT authentication after instantiation
useJWTAuth(jwtConfig: JWTAuthConfig): this

// Start listening for SSE events
async start(handler: RequestHandler): Promise<void>

// Stop the SSE connection
async stop(): Promise<void>
```

## Key Differences from HTTP Agents

| Feature | HTTP Agent | SSE Agent |
|---------|------------|-----------|
| **Connection Model** | Hosts HTTP server | Connects to Cubicler via SSE |
| **Communication** | Request-response | Push-based events |
| **Network Setup** | Requires open ports | Outbound connection only |
| **Deployment** | Traditional server deployment | Container-friendly |
| **Real-time** | Polling required | Native push support |
| **Tool Calls** | Uses `HttpAgentClient` | Uses `HttpAgentClient` |

## Authentication

SSE agents support the same JWT authentication as HTTP agents:

### Static JWT

```typescript
const server = new SSEAgentServer(
  'http://localhost:8080',
  'my-agent',
  30000,
  {
    type: 'static',
    token: 'your-jwt-token'
  }
);
```

### OAuth 2.0

```typescript
const server = new SSEAgentServer('http://localhost:8080', 'my-agent')
  .useJWTAuth({
    type: 'oauth',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    tokenEndpoint: 'https://auth.example.com/token'
  });
```

## Complete Example with Authentication

```typescript
import { 
  CubicAgent, 
  HttpAgentClient, 
  SSEAgentServer,
  createDefaultMemoryRepository
} from '@cubicler/cubicagentkit';

async function createSSEAgent() {
  // Client for tool calls (also supports JWT)
  const client = new HttpAgentClient('http://localhost:1503')
    .useJWTAuth({
      type: 'static',
      token: process.env.CUBICLER_TOKEN
    });

  // SSE server with OAuth authentication
  const server = new SSEAgentServer(
    'http://localhost:8080',
    'weather-agent',
    30000,
    {
      type: 'oauth',
      clientId: process.env.OAUTH_CLIENT_ID!,
      clientSecret: process.env.OAUTH_CLIENT_SECRET!,
      tokenEndpoint: 'https://auth.example.com/token'
    }
  );
  
  const memory = await createDefaultMemoryRepository();
  const agent = new CubicAgent(client, server, memory);
  
  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userMessage = lastMessage.content || '';
    
    // JWT token automatically included in:
    // 1. SSE connection headers (Authorization: Bearer <token>)  
    // 2. HTTP response headers when sending back results
    
    if (userMessage.toLowerCase().includes('weather')) {
      const weather = await client.callTool('weatherService_getCurrentWeather', {
        city: 'Paris'
      });
      
      // Store in memory
      await context.memory?.remember(
        `Weather request for Paris: ${weather.temperature}°C`,
        0.7,
        ['weather', 'paris']
      );
      
      return {
        type: 'text',
        content: `Weather: ${weather.temperature}°C`,
        usedToken: 50
      };
    }
    
    return {
      type: 'text',
      content: 'Hello! Ask me about the weather.',
      usedToken: 20
    };
  });
  
  console.log('🔐 SSE Agent with JWT authentication started');
}

createSSEAgent().catch(console.error);
```

## Connection Management

SSE agents handle connection management automatically:

```typescript
const server = new SSEAgentServer('http://localhost:8080', 'my-agent');

// Connection events are handled internally
await server.start(async (request, client, context) => {
  // Your handler logic here
  return { type: 'text', content: 'Response', usedToken: 10 };
});

// The connection will automatically:
// - Retry on connection loss
// - Handle authentication renewal
// - Parse incoming SSE events
// - Send responses back via HTTP
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
    console.error('SSE Agent error:', error);
    
    // Handle SSE-specific errors
    if (error.message.includes('connection')) {
      // Connection will automatically retry
      return {
        type: 'text',
        content: 'Connection issue, retrying...',
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

## Deployment Advantages

### Container-Friendly

SSE agents are ideal for containerized deployments:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

# No EXPOSE needed - only outbound connections
CMD ["node", "dist/sse-agent.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sse-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sse-agent
  template:
    metadata:
      labels:
        app: sse-agent
    spec:
      containers:
      - name: sse-agent
        image: my-sse-agent:latest
        env:
        - name: CUBICLER_SSE_URL
          value: "http://cubicler-service:8080"
        - name: AGENT_ID
          value: "weather-agent-${HOSTNAME}"
        - name: OAUTH_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: client-id
        # No ports needed for SSE agents!
```

### Serverless/Function Deployment

SSE agents can work in serverless environments:

```typescript
// AWS Lambda, Google Cloud Functions, etc.
export const handler = async () => {
  const server = new SSEAgentServer(
    process.env.CUBICLER_SSE_URL,
    `agent-${process.env.AWS_LAMBDA_REQUEST_ID}`
  );
  
  const agent = new CubicAgent(client, server);
  
  // Start and let it run
  await agent.start(async (request, client, context) => {
    // Handle requests
    return { type: 'text', content: 'Processing...', usedToken: 10 };
  });
};
```

## Scaling Patterns

### Multiple Agent Instances

```typescript
// Scale by running multiple instances with different agent IDs
const agentId = `weather-agent-${process.env.INSTANCE_ID || Math.random()}`;
const server = new SSEAgentServer('http://localhost:8080', agentId);
```

### Load Distribution

Cubicler can distribute requests across multiple SSE agents:

```typescript
// Agent 1
const server1 = new SSEAgentServer('http://localhost:8080', 'weather-agent-1');

// Agent 2
const server2 = new SSEAgentServer('http://localhost:8080', 'weather-agent-2');

// Agent 3
const server3 = new SSEAgentServer('http://localhost:8080', 'weather-agent-3');

// Cubicler handles load balancing between agents
```

## Monitoring and Health Checks

```typescript
import { CubicAgent, HttpAgentClient, SSEAgentServer } from '@cubicler/cubicagentkit';

let isHealthy = false;
let lastRequestTime = Date.now();

const server = new SSEAgentServer('http://localhost:8080', 'my-agent');

// Track connection health
server.on('connect', () => {
  console.log('SSE connection established');
  isHealthy = true;
});

server.on('disconnect', () => {
  console.log('SSE connection lost');
  isHealthy = false;
});

server.on('error', (error) => {
  console.error('SSE error:', error);
  isHealthy = false;
});

const agent = new CubicAgent(client, server);

await agent.start(async (request, client, context) => {
  lastRequestTime = Date.now();
  
  // Your handler logic
  return { type: 'text', content: 'OK', usedToken: 5 };
});

// Health check endpoint (if needed for orchestration)
setInterval(() => {
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  console.log(`Health: ${isHealthy}, Last request: ${timeSinceLastRequest}ms ago`);
}, 30000);
```

## Best Practices

1. **Agent IDs**: Use unique, descriptive agent IDs
2. **Connection Retry**: Let the library handle automatic reconnection
3. **Authentication**: Use OAuth for production deployments
4. **Error Handling**: Handle both connection and business logic errors
5. **Monitoring**: Track connection health and request processing
6. **Graceful Shutdown**: Clean up connections on shutdown

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down SSE agent...');
  await agent.stop();
  process.exit(0);
});
```

## Troubleshooting

### Connection Issues

**SSE Connection Refused**

```
Error: connect ECONNREFUSED 127.0.0.1:8080
```

- Verify Cubicler's SSE endpoint is accessible
- Check firewall and network configuration

**Authentication Failures**

```
Error: 401 Unauthorized on SSE connection
```

- Verify JWT token is valid and not expired
- Check OAuth configuration if using OAuth flow

**Event Parsing Errors**

```
Error: Failed to parse SSE event
```

- Usually indicates a protocol version mismatch
- Ensure CubicAgentKit version is compatible with Cubicler

### Performance Issues

**High Memory Usage**

- Check for memory leaks in your handler logic
- Ensure proper cleanup of resources

**Slow Response Times**

- Monitor tool call latency
- Check memory system performance

For more authentication patterns, see [JWT_AUTH.md](JWT_AUTH.md).
For memory optimization, see [MEMORY_SYSTEM.md](MEMORY_SYSTEM.md).
