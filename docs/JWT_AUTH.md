# JWT Authentication Guide

CubicAgentKit provides comprehensive JWT authentication support for both client and server components, supporting static tokens and OAuth 2.0 flows with automatic token management.

## Overview

JWT authentication in CubicAgentKit works at two levels:

1. **Client Authentication**: Authenticate HTTP requests to Cubicler
2. **Server Authentication**: Validate incoming requests to your agent

## Features

- **Static JWT**: Simple token-based authentication
- **OAuth 2.0**: Client credentials flow with automatic token refresh
- **Automatic Token Management**: Token injection, validation, and refresh
- **Flexible Configuration**: Multiple configuration options
- **TypeScript Support**: Full type safety with comprehensive interfaces

## Client Authentication

### Static JWT

Use a pre-generated JWT token for client requests:

```typescript
import { HttpAgentClient, StaticJWTAuth } from '@cubicler/cubicagentkit';

// Static JWT configuration
const jwtConfig: StaticJWTAuth = {
  type: 'static',
  token: 'your-jwt-token-here'
};

// Configure in constructor
const client = new HttpAgentClient('http://localhost:1503', 30000, jwtConfig);

// Or configure after instantiation
const client = new HttpAgentClient('http://localhost:1503')
  .useJWTAuth(jwtConfig);
```

### OAuth 2.0

Use OAuth 2.0 client credentials flow with automatic token management:

```typescript
import { HttpAgentClient, OAuthJWTAuth } from '@cubicler/cubicagentkit';

// OAuth client configuration
const oauthConfig: OAuthJWTAuth = {
  type: 'oauth',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenEndpoint: 'https://auth.example.com/oauth/token',
  scope: 'cubicler:read cubicler:write',
  grantType: 'client_credentials'
};

const client = new HttpAgentClient('http://localhost:1503', 30000, oauthConfig);

// Client will automatically:
// 1. Acquire access token on first request
// 2. Cache and reuse valid tokens  
// 3. Refresh expired tokens automatically
// 4. Retry failed requests with new tokens
```

### Environment-Based Configuration

```typescript
import { HttpAgentClient, JWTAuthConfig } from '@cubicler/cubicagentkit';

function createAuthenticatedClient(): HttpAgentClient {
  let jwtConfig: JWTAuthConfig | undefined;
  
  if (process.env.JWT_TOKEN) {
    // Use static token
    jwtConfig = {
      type: 'static',
      token: process.env.JWT_TOKEN
    };
  } else if (process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET) {
    // Use OAuth
    jwtConfig = {
      type: 'oauth',
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'https://auth.example.com/token',
      scope: process.env.OAUTH_SCOPE
    };
  }
  
  return new HttpAgentClient(
    process.env.CUBICLER_URL || 'http://localhost:1503',
    parseInt(process.env.REQUEST_TIMEOUT || '30000'),
    jwtConfig
  );
}

const client = createAuthenticatedClient();
```

## Server Authentication

### Basic JWT Validation

Validate incoming requests to your agent:

```typescript
import { HttpAgentServer, JWTMiddlewareConfig } from '@cubicler/cubicagentkit';

// JWT validation configuration
const jwtConfig: JWTMiddlewareConfig = {
  verification: {
    secret: 'your-jwt-secret',
    algorithms: ['HS256'],
    issuer: 'https://your-auth-server.com',
    audience: 'your-api',
    ignoreExpiration: false
  }
};

// All requests must have valid JWT
const server = new HttpAgentServer(3000, '/agent', jwtConfig);
```

### Optional Authentication

Allow requests with or without JWT:

```typescript
const server = new HttpAgentServer(3000, '/agent')
  .useJWTAuth(jwtConfig, true); // true = optional
```

### Custom Token Extraction

Extract tokens from custom headers or cookies:

```typescript
const customJWTConfig: JWTMiddlewareConfig = {
  verification: {
    secret: 'your-secret',
    algorithms: ['HS256']
  },
  extractToken: (req) => {
    // Extract from custom header
    const customHeader = req.headers['x-auth-token'] as string;
    if (customHeader) return customHeader;
    
    // Extract from cookie
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      return match ? match[1] : undefined;
    }
    
    // Extract from query parameter
    if (req.query?.token) {
      return req.query.token as string;
    }
    
    return undefined;
  },
  onAuthFailure: (error, req, res, next) => {
    console.error('Authentication failed:', error.message);
    res.status(401).json({
      error: 'Authentication Required',
      message: 'Please provide a valid authentication token',
      code: 'AUTH_REQUIRED'
    });
  }
};

const server = new HttpAgentServer(3000, '/agent')
  .useJWTAuth(customJWTConfig);
```

## SSE Authentication

SSE servers support the same JWT authentication:

```typescript
import { SSEAgentServer, JWTAuthConfig } from '@cubicler/cubicagentkit';

// Static JWT for SSE connection
const jwtConfig: JWTAuthConfig = {
  type: 'static',
  token: 'your-jwt-token'
};

const sseServer = new SSEAgentServer(
  'http://localhost:8080',
  'my-agent',
  30000,
  jwtConfig
);

// OAuth for SSE connection
const sseServer = new SSEAgentServer('http://localhost:8080', 'my-agent')
  .useJWTAuth({
    type: 'oauth',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    tokenEndpoint: 'https://auth.example.com/token'
  });
```

## Complete Authentication Examples

### Full Stack with JWT

```typescript
import { 
  CubicAgent,
  HttpAgentClient,
  HttpAgentServer,
  createDefaultMemoryRepository,
  OAuthJWTAuth,
  JWTMiddlewareConfig
} from '@cubicler/cubicagentkit';

async function createSecureAgent() {
  // OAuth client for calling Cubicler
  const clientAuth: OAuthJWTAuth = {
    type: 'oauth',
    clientId: 'cubicler-agent',
    clientSecret: process.env.CLIENT_SECRET!,
    tokenEndpoint: 'https://auth.example.com/token',
    scope: 'cubicler:full'
  };
  
  const client = new HttpAgentClient('http://localhost:1503', 30000, clientAuth);
  
  // JWT validation for incoming requests
  const serverAuth: JWTMiddlewareConfig = {
    verification: {
      secret: process.env.JWT_SECRET!,
      algorithms: ['HS256'],
      issuer: 'https://auth.example.com',
      audience: 'my-agent-api'
    }
  };
  
  const server = new HttpAgentServer(3000, '/agent', serverAuth);
  const memory = await createDefaultMemoryRepository();
  
  const agent = new CubicAgent(client, server, memory);
  
  await agent.start(async (request, client, context) => {
    // JWT payload available in request context
    const user = (request as any).user;
    console.log('Authenticated user:', user?.sub);
    
    // Store authenticated interaction
    await context.memory?.remember(
      `Authenticated request from user ${user?.sub}`,
      0.7,
      ['auth', 'interaction']
    );
    
    // Make authenticated calls to Cubicler
    const result = await client.callTool('someTool', { param: 'value' });
    
    return {
      type: 'text',
      content: `Securely processed for user ${user?.sub}: ${JSON.stringify(result)}`,
      usedToken: 50
    };
  });
  
  console.log('🔐 Secure agent running with JWT authentication');
}

createSecureAgent().catch(console.error);
```

### Multi-Environment Setup

```typescript
interface AuthConfig {
  client: JWTAuthConfig;
  server?: JWTMiddlewareConfig;
}

function getAuthConfig(): AuthConfig {
  switch (process.env.NODE_ENV) {
    case 'development':
      return {
        client: {
          type: 'static',
          token: 'dev-token'
        }
        // No server auth in development
      };
      
    case 'staging':
      return {
        client: {
          type: 'oauth',
          clientId: process.env.STAGING_CLIENT_ID!,
          clientSecret: process.env.STAGING_CLIENT_SECRET!,
          tokenEndpoint: 'https://auth-staging.example.com/token'
        },
        server: {
          verification: {
            secret: process.env.STAGING_JWT_SECRET!,
            algorithms: ['HS256']
          }
        }
      };
      
    case 'production':
      return {
        client: {
          type: 'oauth',
          clientId: process.env.PROD_CLIENT_ID!,
          clientSecret: process.env.PROD_CLIENT_SECRET!,
          tokenEndpoint: 'https://auth.example.com/token',
          scope: 'cubicler:full'
        },
        server: {
          verification: {
            secret: process.env.PROD_JWT_SECRET!,
            algorithms: ['RS256'],
            publicKey: process.env.PROD_JWT_PUBLIC_KEY!,
            issuer: 'https://auth.example.com',
            audience: 'cubicler-agents'
          }
        }
      };
      
    default:
      throw new Error(`Unknown environment: ${process.env.NODE_ENV}`);
  }
}

async function createAgent() {
  const authConfig = getAuthConfig();
  
  const client = new HttpAgentClient('http://localhost:1503')
    .useJWTAuth(authConfig.client);
  
  const server = authConfig.server
    ? new HttpAgentServer(3000, '/agent', authConfig.server)
    : new HttpAgentServer(3000, '/agent');
  
  const agent = new CubicAgent(client, server);
  
  await agent.start(async (request, client, context) => {
    return {
      type: 'text',
      content: `Environment: ${process.env.NODE_ENV}`,
      usedToken: 10
    };
  });
}
```

## JWT Type Definitions

### Client Configuration Types

```typescript
// Static JWT configuration
interface StaticJWTAuth {
  type: 'static';
  token: string;
}

// OAuth JWT configuration  
interface OAuthJWTAuth {
  type: 'oauth';
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  scope?: string;
  grantType?: 'client_credentials' | 'authorization_code';
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
}

// Union type for client authentication
type JWTAuthConfig = StaticJWTAuth | OAuthJWTAuth;
```

### Server Configuration Types

```typescript
// JWT verification options
interface JWTVerificationOptions {
  secret?: string;
  publicKey?: string;
  algorithms?: string[];
  issuer?: string;
  audience?: string;
  ignoreExpiration?: boolean;
  clockTolerance?: number;
  maxAge?: string | number;
}

// Server middleware configuration
interface JWTMiddlewareConfig {
  verification: JWTVerificationOptions;
  extractToken?: (req: any) => string | undefined;
  onAuthFailure?: (error: Error, req: any, res: any, next: any) => void;
}

// JWT payload available in requests
interface JWTRequest extends Request {
  jwt?: JWTPayload;  // Raw JWT payload
  user?: any;        // Convenience alias for jwt
}
```

## Error Handling

### Client-Side Errors

```typescript
try {
  await client.initialize();
  const result = await client.callTool('someTool', { param: 'value' });
} catch (error) {
  if (error.message.includes('JWT authentication failed')) {
    console.error('Token acquisition failed:', error);
    // Handle token acquisition failure
  } else if (error.message.includes('401')) {
    console.error('Authentication failed:', error);
    // Handle authentication failure
  } else if (error.message.includes('403')) {
    console.error('Authorization failed:', error);
    // Handle authorization failure
  }
}
```

### Server-Side Errors

```typescript
const jwtConfig: JWTMiddlewareConfig = {
  verification: { 
    secret: process.env.JWT_SECRET!,
    algorithms: ['HS256']
  },
  onAuthFailure: (error, req, res, next) => {
    console.error('JWT validation failed:', error.message);
    
    // Categorize errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'token_expired',
        message: 'JWT token has expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'invalid_token',
        message: 'JWT token is invalid' 
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ 
        error: 'token_not_active',
        message: 'JWT token is not active yet' 
      });
    }
    
    // Generic authentication error
    return res.status(401).json({ 
      error: 'authentication_failed',
      message: 'Authentication required' 
    });
  }
};
```

## Security Best Practices

### Secret Management

```typescript
// ❌ Don't hardcode secrets
const badConfig = {
  verification: {
    secret: 'my-secret-key',  // Never do this!
    algorithms: ['HS256']
  }
};

// ✅ Use environment variables
const goodConfig = {
  verification: {
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256']
  }
};

// ✅ Validate required environment variables
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### Token Refresh Handling

```typescript
// OAuth tokens are automatically refreshed by the client
const oauthClient = new HttpAgentClient('http://localhost:1503')
  .useJWTAuth({
    type: 'oauth',
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!,
    tokenEndpoint: 'https://auth.example.com/token'
    // Token refresh is handled automatically
  });

// For static tokens, implement refresh logic if needed
class RefreshableStaticClient extends HttpAgentClient {
  private tokenRefreshCallback?: () => Promise<string>;
  
  setTokenRefresh(callback: () => Promise<string>) {
    this.tokenRefreshCallback = callback;
  }
  
  async callTool(toolName: string, parameters: any) {
    try {
      return await super.callTool(toolName, parameters);
    } catch (error) {
      if (error.status === 401 && this.tokenRefreshCallback) {
        // Refresh token and retry
        const newToken = await this.tokenRefreshCallback();
        this.useJWTAuth({ type: 'static', token: newToken });
        return await super.callTool(toolName, parameters);
      }
      throw error;
    }
  }
}
```

### HTTPS in Production

```typescript
// Always use HTTPS in production
const server = new HttpAgentServer(3000, '/agent')
  .useJWTAuth(jwtConfig);

// Add HTTPS enforcement middleware
server.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

### Token Validation

```typescript
const productionJWTConfig: JWTMiddlewareConfig = {
  verification: {
    // Use RS256 for production (requires public key)
    algorithms: ['RS256'],
    publicKey: process.env.JWT_PUBLIC_KEY!,
    issuer: 'https://auth.example.com',
    audience: 'cubicler-agents',
    ignoreExpiration: false,
    clockTolerance: 30, // 30 seconds tolerance for clock skew
    maxAge: '24h' // Maximum token age
  },
  extractToken: (req) => {
    // Only extract from Authorization header in production
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return undefined;
  }
};
```

## Troubleshooting

### Common Issues

**Token Not Found**

```typescript
// Make sure token extraction is working
const debugConfig: JWTMiddlewareConfig = {
  verification: { secret: 'secret' },
  extractToken: (req) => {
    console.log('Headers:', req.headers);
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('Extracted token:', token ? 'found' : 'not found');
    return token;
  }
};
```

**Clock Skew Issues**

```typescript
// Add clock tolerance for time synchronization issues
const tolerantConfig: JWTMiddlewareConfig = {
  verification: {
    secret: process.env.JWT_SECRET!,
    algorithms: ['HS256'],
    clockTolerance: 300 // 5 minutes tolerance
  }
};
```

**OAuth Token Refresh Failures**

```typescript
// Add error handling for OAuth failures
try {
  const result = await client.callTool('tool', {});
} catch (error) {
  if (error.message.includes('Failed to refresh token')) {
    console.error('OAuth refresh failed - check client credentials');
  }
}
```

### Debugging

Enable detailed JWT logging:

```typescript
const debugJWTConfig: JWTMiddlewareConfig = {
  verification: {
    secret: process.env.JWT_SECRET!,
    algorithms: ['HS256']
  },
  onAuthFailure: (error, req, res, next) => {
    console.error('JWT Debug Info:', {
      error: error.message,
      headers: req.headers,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    
    res.status(401).json({ error: 'Authentication failed' });
  }
};
```

## Integration Examples

For transport-specific authentication examples, see:

- [HTTP_AGENT.md](HTTP_AGENT.md#authentication) - HTTP agent authentication
- [SSE_AGENT.md](SSE_AGENT.md#authentication) - SSE agent authentication

For production deployment patterns with authentication, see the deployment sections in the transport guides.
