import { AgentRequest, MessageRequest, TriggerRequest } from '../model/agent-request.js';
import { AgentResponse, RawAgentResponse } from '../model/agent-response.js';
import { AgentClient } from './agent-client.js';
import { MemoryRepository } from './memory-repository.js';

/**
 * Tracking context that provides call statistics and optional memory access
 */
export interface CallContext {
  readonly toolCallCount: number;
  readonly memory?: MemoryRepository;
}

/**
 * Request handler signature for HTTP server - only handles the request
 */
export type RequestHandler = (request: AgentRequest) => Promise<AgentResponse>;

/**
 * Message handler signature for processing user conversation requests
 */
export type MessageHandler = (request: MessageRequest, client: AgentClient, context: CallContext) => Promise<RawAgentResponse>;

/**
 * Trigger handler signature for processing webhook trigger requests
 */
export type TriggerHandler = (request: TriggerRequest, client: AgentClient, context: CallContext) => Promise<RawAgentResponse>;

/**
 * Internal dispatch handler for routing requests (used internally by CubicAgent)
 * @internal
 */
export type DispatchHandler = (request: AgentRequest, client: AgentClient, context: CallContext) => Promise<RawAgentResponse>;

/**
 * Builder interface for configuring agent handlers with fluent API
 */
export interface AgentBuilder {
  /**
   * Register handler for message-based requests (user conversations)
   * @param handler - Function to handle message requests
   */
  onMessage(handler: MessageHandler): AgentBuilder;
  
  /**
   * Register handler for trigger-based requests (webhook calls)
   * @param handler - Function to handle trigger requests
   */
  onTrigger(handler: TriggerHandler): AgentBuilder;
  
  /**
   * Start the server with registered handlers
   * Can only be called once - subsequent calls will throw an error
   * @throws Error if called multiple times
   */
  listen(): Promise<void>;
}

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
