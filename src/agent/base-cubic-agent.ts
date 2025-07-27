import type { Express, Request, Response } from 'express';
import type { AgentConfig, CubicAgentOptions, CallHandler, AgentRequest, AgentResponse, CallContext, ICubiclerClient, JSONObject } from '../models/types.js';
import { Logger } from '../utils/logger.js';
import { prependAgentHeader } from '../utils/agent-header.js';

/**
 * Base class for shared functionality between CubicAgent implementations
 */
export abstract class BaseCubicAgent {
  protected config: AgentConfig | CubicAgentOptions;
  protected client: ICubiclerClient;
  private callHandler: CallHandler | null = null;
  protected logger: Logger;

  constructor(config: AgentConfig | CubicAgentOptions) {
    this.config = config;
    this.client = config.cubiclerClient; // Required injection
    this.logger = new Logger(config.logLevel || 'info');
  }

  /**
   * Register the handler function for processing agent calls
   */
  onCall(handler: CallHandler): void {
    this.callHandler = handler;
  }

  /**
   * Set up Express routes for the agent
   */
  protected setupRoutes(app: Express): void {
    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', agent: this.config.agentName });
    });

    // Main call endpoint
    app.post('/call', async (req: Request, res: Response) => {
      try {
        if (!this.callHandler) {
          return res.status(500).json({
            error: 'Agent handler not configured. Call onCall() first.'
          });
        }

        const request: AgentRequest = req.body;

        // Validate request format
        if (!request.prompt || !request.providers || !request.messages) {
          return res.status(400).json({
            error: 'Invalid request format. Expected: { prompt, providers, messages }'
          });
        }

        // Create enhanced request with mandatory agent header
        const enhancedPrompt = prependAgentHeader(
          this.config.agentName,
          request.prompt
        );

        const enhancedRequest: AgentRequest = {
          ...request,
          prompt: enhancedPrompt
        };

        // Create context for provider interaction
        const context: CallContext = {
          getProviderSpec: (providerName: string) => this.client.getProviderSpec(providerName),
          executeFunction: (functionName: string, parameters: JSONObject) =>
            this.client.executeFunction(functionName, parameters)
        };

        // Execute user handler
        const responseMessage = await this.callHandler(enhancedRequest, context);

        const response: AgentResponse = {
          message: responseMessage
        };

        res.json(response);

      } catch (error) {
        this.logger.error('Error processing agent call:', error);
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }
}
