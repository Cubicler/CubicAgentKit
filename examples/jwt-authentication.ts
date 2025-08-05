/**
 * JWT Authentication Examples for CubicAgentKit
 * 
 * This file demonstrates how to use JWT authentication with both
 * static tokens and OAuth flows for AxiosAgentClient and ExpressAgentServer.
 */

import { 
  CubicAgent,
  AxiosAgentClient, 
  ExpressAgentServer,
  createDefaultMemoryRepository,
  JWTAuthConfig,
  JWTMiddlewareConfig,
  StaticJWTAuth,
  OAuthJWTAuth
} from '../src/index.js';

// Example 1: Static JWT Authentication for Client
async function clientWithStaticJWT() {
  console.log('Example 1: AxiosAgentClient with Static JWT');
  
  const staticJWTConfig: StaticJWTAuth = {
    type: 'static',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaWF0IjoxNzMzNDM2MDAwfQ.fake-signature'
  };

  // Option 1: Pass JWT config to constructor
  const client1 = new AxiosAgentClient('http://localhost:1503', 30000, staticJWTConfig);
  
  // Option 2: Configure JWT after instantiation
  const client2 = new AxiosAgentClient('http://localhost:1503')
    .useJWTAuth(staticJWTConfig);

  console.log('Clients configured with static JWT tokens');
  
  // Both clients will now automatically add "Authorization: Bearer <token>" to all requests
  // and handle token refresh on 401 errors (though static tokens can't be refreshed)
}

// Example 2: OAuth JWT Authentication for Client
async function clientWithOAuthJWT() {
  console.log('Example 2: AxiosAgentClient with OAuth JWT');
  
  const oauthJWTConfig: OAuthJWTAuth = {
    type: 'oauth',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    tokenEndpoint: 'https://your-auth-server.com/oauth/token',
    scope: 'cubicler:read cubicler:write',
    grantType: 'client_credentials'
  };

  const client = new AxiosAgentClient('http://localhost:1503', 30000, oauthJWTConfig);
  
  console.log('Client configured with OAuth JWT');
  
  // The client will:
  // 1. Automatically acquire an access token on first request
  // 2. Cache the token and reuse it while valid
  // 3. Refresh the token automatically when it expires
  // 4. Retry failed requests with new tokens on 401 errors
  
  try {
    await client.initialize();
    console.log('Client initialized successfully with OAuth token');
  } catch (error) {
    console.error('Failed to initialize client:', error);
  }
}

// Example 3: Express Server with JWT Authentication
async function serverWithJWT() {
  console.log('Example 3: ExpressAgentServer with JWT Authentication');
  
  const jwtMiddlewareConfig: JWTMiddlewareConfig = {
    verification: {
      secret: 'your-jwt-secret-key',
      algorithms: ['HS256'],
      issuer: 'https://your-auth-server.com',
      audience: 'cubicler-api',
      ignoreExpiration: false
    }
  };

  // Option 1: Pass JWT config to constructor
  const server1 = new ExpressAgentServer(3000, '/agent', jwtMiddlewareConfig);
  
  // Option 2: Configure JWT after instantiation
  const server2 = new ExpressAgentServer(3001, '/agent')
    .useJWTAuth(jwtMiddlewareConfig);

  // Option 3: Optional JWT (allows requests with or without tokens)
  const server3 = new ExpressAgentServer(3002, '/agent')
    .useJWTAuth(jwtMiddlewareConfig, true); // true = optional

  console.log('Servers configured with JWT authentication');
  
  // The servers will:
  // 1. Validate JWT tokens on incoming requests
  // 2. Reject requests with invalid/expired tokens (required mode)
  // 3. Allow requests without tokens in optional mode
  // 4. Attach JWT payload to req.jwt and req.user
}

// Example 4: Complete CubicAgent with JWT Authentication
async function completeJWTExample() {
  console.log('Example 4: Complete CubicAgent setup with JWT');
  
  // Client with OAuth
  const oauthConfig: OAuthJWTAuth = {
    type: 'oauth',
    clientId: 'cubicler-agent',
    clientSecret: 'your-secret',
    tokenEndpoint: 'https://auth.example.com/token',
    scope: 'cubicler:full'
  };
  
  const client = new AxiosAgentClient('http://localhost:1503', 30000, oauthConfig);
  
  // Server with JWT validation
  const jwtConfig: JWTMiddlewareConfig = {
    verification: {
      secret: 'your-jwt-secret',
      algorithms: ['HS256'],
      issuer: 'https://auth.example.com',
      ignoreExpiration: false
    }
  };
  
  const server = new ExpressAgentServer(3000, '/agent', jwtConfig);
  
  // Memory repository
  const memory = await createDefaultMemoryRepository();
  
  // Create the agent
  const agent = new CubicAgent(client, server, memory);
  
  // Start the agent
  await agent.start(async (request, client, context) => {
    // The request handler now has access to JWT information
    // through the server's request context (if using Express with JWT)
    
    console.log('Processing request with JWT context');
    
    // Store interaction in memory
    await context.memory?.remember(
      `User interaction: ${request.messages[0]?.content || 'No message'}`,
      0.7,
      ['user-interaction', 'jwt-authenticated']
    );
    
    // Call tools through authenticated client
    try {
      const result = await client.callTool('someTool', { param: 'value' });
      
      return {
        type: 'text',
        content: `Processed request successfully: ${JSON.stringify(result)}`,
        usedToken: 50
      };
    } catch (error) {
      return {
        type: 'text',
        content: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        usedToken: 10
      };
    }
  });
  
  console.log('CubicAgent started with full JWT authentication');
}

// Example 5: Custom JWT Configuration
async function customJWTConfiguration() {
  console.log('Example 5: Custom JWT Configuration');
  
  // Custom token extraction (e.g., from cookies or custom headers)
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
      
      return undefined;
    },
    onAuthFailure: (error, req, res, next) => {
      console.error('JWT Authentication failed:', error.message);
      res.status(401).json({
        error: 'Authentication Required',
        message: 'Please provide a valid authentication token',
        timestamp: new Date().toISOString()
      });
    }
  };
  
  const server = new ExpressAgentServer(3000, '/agent')
    .useJWTAuth(customJWTConfig);
    
  console.log('Server configured with custom JWT extraction and error handling');
}

// Run examples
async function runExamples() {
  try {
    await clientWithStaticJWT();
    console.log('---');
    
    await clientWithOAuthJWT();
    console.log('---');
    
    await serverWithJWT();
    console.log('---');
    
    await completeJWTExample();
    console.log('---');
    
    await customJWTConfiguration();
    
    console.log('All JWT examples completed successfully!');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in other files
export {
  clientWithStaticJWT,
  clientWithOAuthJWT,
  serverWithJWT,
  completeJWTExample,
  customJWTConfiguration
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}