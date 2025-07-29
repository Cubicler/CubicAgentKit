import { AgentRequest } from '../model/agent-request.js';
import { AgentResponse, RawAgentResponse } from '../model/agent-response.js';
import { AgentClient } from './agent-client.js';

/**
 * Tracking context that provides call statistics
 */
export interface CallContext {
  readonly toolCallCount: number;
}

/**
 * Request handler signature for HTTP server - only handles the request
 */
export type RequestHandler = (request: AgentRequest) => Promise<AgentResponse>;

/**
 * Dispatch handler signature for processing agent requests with client access and call tracking
 */
export type DispatchHandler = (request: AgentRequest, client: AgentClient, context: CallContext) => Promise<RawAgentResponse>;

/**
 * Interface for HTTP server management
 * This interface can be customized for different environments (Express, Fastify, etc.)
 */
export interface AgentServer {
  /**
   * Start the HTTP server and register the request handler
   * @param handler - The function to handle incoming agent requests
   * @throws Error if server startup fails
   */
  start(handler: RequestHandler): Promise<void>;

  /**
   * Stop the HTTP server
   * @throws Error if server shutdown fails
   */
  stop(): Promise<void>;
}
