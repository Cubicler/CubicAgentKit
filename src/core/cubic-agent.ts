import { AgentClient } from '../interface/agent-client.js';
import { AgentServer, DispatchHandler, CallContext } from '../interface/agent-server.js';
import { TrackingAgentClient } from './tracking-agent-client.js';

/**
 * Main orchestrator class for CubicAgent
 * Handles HTTP server management and dispatch routing using composition
 */
export class CubicAgent {
  /**
   * Creates a new CubicAgent instance
   * @param agentClient - The client for communicating with Cubicler
   * @param server - The server implementation for handling HTTP requests
   */
  constructor(
    private readonly agentClient: AgentClient,
    private readonly server: AgentServer
  ) {}

  /**
   * Start the agent server with the provided dispatch handler
   * This method:
   * 1. Initializes the AgentClient
   * 2. Starts the HTTP server with a wrapped handler that provides a fresh tracking client per request
   * 
   * @param handler - The dispatch handler function to process requests
   * @throws Error if startup fails (thrown up to implementer)
   */
  async start(handler: DispatchHandler): Promise<void> {
    // Initialize the agent client connection to Cubicler
    await this.agentClient.initialize();

    // Start the HTTP server with the wrapped handler
    await this.server.start(async (request) => {
      // Create a fresh tracking client for this specific request
      const trackingClient = new TrackingAgentClient(this.agentClient);
      
      // Create context with access to the tracking client's call count
      const context: CallContext = {
        get toolCallCount() {
          return trackingClient.getCallCount();
        }
      };
      
      const response = await handler(request, trackingClient, context);
      
      // Convert RawAgentResponse to complete AgentResponse
      return {
        timestamp: new Date().toISOString(),
        type: response.type,
        content: response.content,
        metadata: {
          usedTools: trackingClient.getCallCount(),
          usedToken: response.usedToken,
        }
      };
    });
  }

  /**
   * Stop the agent server
   * @throws Error if shutdown fails (thrown up to implementer)
   */
  async stop(): Promise<void> {
    await this.server.stop();
  }
}
