import { AgentClient } from '../interface/agent-client.js';
import { AgentServer, DispatchHandler, CallContext } from '../interface/agent-server.js';
import { MemoryRepository } from '../interface/memory-repository.js';
import { TrackingAgentClient } from '../client/tracking-agent-client.js';
import { AgentRequest } from '../model/agent-request.js';
import { AgentResponse } from '../model/agent-response.js';

/**
 * Main orchestrator class for CubicAgent
 * Handles HTTP server management and dispatch routing using composition
 */
export class CubicAgent {
  private isInitialized = false;
  private dispatchHandler?: DispatchHandler;

  /**
   * Creates a new CubicAgent instance
   * @param agentClient - The client for communicating with Cubicler
   * @param server - The server implementation for handling HTTP requests
   * @param memory - Optional memory repository for agent context
   */
  constructor(
    private readonly agentClient: AgentClient,
    private readonly server: AgentServer,
    private readonly memory?: MemoryRepository
  ) {}

  /**
   * Start the agent server with the provided dispatch handler
   * This method starts the HTTP server with a wrapped handler that provides a fresh tracking client per request
   * The AgentClient is initialized lazily on the first request to ensure it's only done when needed
   * 
   * @param handler - The dispatch handler function to process requests
   * @throws Error if startup fails (thrown up to implementer)
   */
  async start(handler: DispatchHandler): Promise<void> {
    this.dispatchHandler = handler;
    
    // Start the HTTP server with the wrapped handler
    await this.server.start(async (request) => {
      return this.executeDispatch(request, handler);
    });
  }

  /**
   * Manually dispatch a request using the configured handler
   * This allows direct invocation of the dispatch logic outside of the server context
   * 
   * @param request - The agent request to process
   * @returns Promise resolving to the complete agent response
   * @throws Error if no dispatch handler is configured or if dispatch fails
   */
  async dispatch(request: AgentRequest): Promise<AgentResponse> {
    if (!this.dispatchHandler) {
      throw new Error('No dispatch handler configured. Call start() first or provide a handler.');
    }
    
    return this.executeDispatch(request, this.dispatchHandler);
  }

  /**
   * Common dispatch execution logic shared by server and manual dispatch
   * @private
   */
  private async executeDispatch(request: AgentRequest, handler: DispatchHandler): Promise<AgentResponse> {
    // Ensure the agent client is initialized (only happens once)
    await this.ensureInitialized();
    
    // Create a fresh tracking client for this specific request
    const trackingClient = new TrackingAgentClient(this.agentClient);
    
    // Create context with access to the tracking client's call count and optional memory
    const context: CallContext = {
      get toolCallCount() {
        return trackingClient.getCallCount();
      },
      memory: this.memory
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
  }

  /**
   * Ensures the agent client is initialized, but only once
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.agentClient.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * Stop the agent server
   * @throws Error if shutdown fails (thrown up to implementer)
   */
  async stop(): Promise<void> {
    await this.server.stop();
  }
}
