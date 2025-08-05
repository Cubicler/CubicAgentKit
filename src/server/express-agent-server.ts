import express, { Express, Request, Response, RequestHandler as ExpressRequestHandler } from 'express';
import { Server } from 'http';
import { AgentServer, RequestHandler } from '../interface/agent-server.js';
import { AgentRequest } from '../model/agent-request.js';
import { JWTMiddlewareConfig } from '../interface/jwt-auth.js';
import { createJWTMiddleware, createOptionalJWTMiddleware, JWTRequest } from '../auth/jwt-middleware.js';

/**
 * Express middleware function type
 */
export type ExpressMiddleware = ExpressRequestHandler;

/**
 * Express-based implementation of AgentServer
 * Handles HTTP server lifecycle and request routing using Express.js
 */
export class ExpressAgentServer implements AgentServer {
  private readonly app: Express;
  private server?: Server;
  private jwtMiddleware?: ExpressRequestHandler;

  /**
   * Creates a new ExpressAgentServer instance
   * @param port - The port number to listen on
   * @param endpoint - The endpoint path to handle requests (default: '/agent')
   * @param jwtConfig - Optional JWT authentication configuration
   */
  constructor(
    private readonly port: number,
    private readonly endpoint: string = '/agent',
    jwtConfig?: JWTMiddlewareConfig
  ) {
    this.app = express();
    
    // Add JSON parsing middleware
    this.app.use(express.json());

    // Set up JWT authentication if provided
    if (jwtConfig) {
      this.jwtMiddleware = createJWTMiddleware(jwtConfig);
    }
  }

  /**
   * Add middleware to the Express app (e.g., CORS, authentication, logging)
   * @param middleware - The Express middleware function to apply
   * @returns this instance for method chaining
   */
  useMiddleware(middleware: ExpressMiddleware): this {
    this.app.use(middleware);
    return this;
  }

  /**
   * Configure JWT authentication for this server
   * @param jwtConfig - JWT middleware configuration
   * @param optional - If true, creates optional JWT middleware that doesn't fail without token
   * @returns this instance for method chaining
   */
  useJWTAuth(jwtConfig: JWTMiddlewareConfig, optional: boolean = false): this {
    this.jwtMiddleware = optional 
      ? createOptionalJWTMiddleware(jwtConfig)
      : createJWTMiddleware(jwtConfig);
    return this;
  }

  /**
   * Start the HTTP server and register the request handler
   * @param handler - The function to handle incoming agent requests
   * @throws Error if server startup fails
   */
  async start(handler: RequestHandler): Promise<void> {
    // Apply JWT middleware to the endpoint if configured
    const middlewares: ExpressRequestHandler[] = [];
    if (this.jwtMiddleware) {
      middlewares.push(this.jwtMiddleware);
    }

    // Register the POST endpoint for agent requests
    this.app.post(this.endpoint, ...middlewares, (req: JWTRequest, res: Response) => {
      void (async () => {
        try {
          // Basic validation of request structure
          if (!req.body || typeof req.body !== 'object') {
            res.status(400).json({
              error: 'Bad Request',
              message: 'Request body must be a valid JSON object'
            });
            return;
          }

          const agentRequest = req.body as AgentRequest;
          
          // Validate required AgentRequest structure
          if (!agentRequest.agent || !agentRequest.tools || !agentRequest.servers || !agentRequest.messages) {
            res.status(400).json({
              error: 'Bad Request',
              message: 'Request must include agent, tools, servers, and messages properties'
            });
            return;
          }

          // Call the handler with the parsed request
          const agentResponse = await handler(agentRequest);
          
          // Send the response back to the client
          res.json(agentResponse);
        } catch (error) {
          // Handle errors and send appropriate HTTP response
          console.error('Error processing agent request:', error);
          res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      })();
    });

    // Start the server
    return new Promise<void>((resolve, reject) => {
      this.server = this.app.listen(this.port, (error?: Error) => {
        if (error) {
          reject(new Error(`Failed to start Express server on port ${this.port}: ${error.message}`));
        } else {
          console.log(`✅ Express server started on port ${this.port}, endpoint: ${this.endpoint}`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the HTTP server
   * @throws Error if server shutdown fails
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return; // Server is not running
    }

    return new Promise<void>((resolve, reject) => {
      if (this.server) {
        this.server.close((error?: Error) => {
          if (error) {
            reject(new Error(`Failed to stop Express server: ${error.message}`));
          } else {
            console.log('✅ Express server stopped');
            this.server = undefined;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
