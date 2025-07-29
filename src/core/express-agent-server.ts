import express, { Express, Request, Response, RequestHandler as ExpressRequestHandler } from 'express';
import { Server } from 'http';
import { AgentServer, RequestHandler } from '../interface/agent-server.js';
import { AgentRequest } from '../model/agent-request.js';

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

  /**
   * Creates a new ExpressAgentServer instance
   * @param port - The port number to listen on
   * @param endpoint - The endpoint path to handle requests (default: '/agent')
   */
  constructor(
    private readonly port: number,
    private readonly endpoint: string = '/agent'
  ) {
    this.app = express();
    
    // Add JSON parsing middleware
    this.app.use(express.json());
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
   * Start the HTTP server and register the request handler
   * @param handler - The function to handle incoming agent requests
   * @throws Error if server startup fails
   */
  async start(handler: RequestHandler): Promise<void> {
    // Register the POST endpoint for agent requests
    this.app.post(this.endpoint, (req: Request, res: Response) => {
      void (async () => {
        try {
          const agentRequest = req.body as AgentRequest;
          
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
