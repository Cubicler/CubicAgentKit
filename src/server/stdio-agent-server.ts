import { AgentServer, RequestHandler } from '../interface/agent-server.js';
import { AgentRequest } from '../model/agent-request.js';
import { AgentResponse } from '../model/agent-response.js';
import { MCPRequest, MCPResponse } from '../model/mcp.js';
import { JSONValue } from '../model/types.js';

/**
 * Stdio-based implementation of AgentServer for handling requests from cubicler
 * Communicates via stdin/stdout using JSON-RPC 2.0 protocol
 */
export class StdioAgentServer implements AgentServer {
  private handler: RequestHandler | null = null;
  private isRunning = false;
  private buffer = '';

  /**
   * Creates a new StdioAgentServer instance
   */
  constructor() {
    // Set up graceful shutdown
    process.on('SIGINT', () => { void this.stop(); });
    process.on('SIGTERM', () => { void this.stop(); });
  }

  /**
   * Start the stdio server and register the request handler
   * Begins listening for MCP requests on stdin
   * @param handler - The function to handle incoming agent requests
   * @throws Error if server startup fails
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async start(handler: RequestHandler): Promise<void> {
    if (this.isRunning) {
      throw new Error('StdioAgentServer is already running');
    }

    this.handler = handler;
    this.isRunning = true;

    // Set up stdin reading
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data: string) => {
      this.handleInput(data);
    });

    // Keep the process alive
    process.stdin.resume();

    // Send server capabilities
    this.sendCapabilities();
  }

    /**
   * Stop the stdio server and clean up resources
   * @throws Error if server shutdown fails
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.handler = null;
    
    // Clean up stdin listeners
    process.stdin.removeAllListeners('data');
    process.stdin.pause();
  }

  /**
   * Handle incoming data from stdin
   * @param data - Raw input data
   * @private
   */
  private handleInput(data: string): void {
    this.buffer += data;

    // Process complete JSON-RPC messages (one per line)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const request = JSON.parse(line) as MCPRequest;
          void this.handleRequest(request);
        } catch {
          this.sendError(null, -32700, 'Parse error', 'Invalid JSON received');
        }
      }
    }
  }

  /**
   * Handle an MCP request
   * @param request - The MCP request to handle
   * @private
   */
  private async handleRequest(request: MCPRequest): Promise<void> {
    try {
      switch (request.method) {
        case 'initialize':
          await this.handleInitialize(request);
          break;
        case 'notifications/initialized':
          // Acknowledge initialization complete
          break;
        case 'agent/dispatch':
          await this.handleDispatch(request);
          break;
        default:
          this.sendError(request.id, -32601, 'Method not found', `Unknown method: ${request.method}`);
      }
    } catch (error) {
      this.sendError(
        request.id,
        -32603,
        'Internal error',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle MCP initialize request
   * @param request - The initialize request
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- May need async in future
  private async handleInitialize(request: MCPRequest): Promise<void> {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          agents: {
            dispatch: true
          }
        },
        serverInfo: {
          name: 'CubicAgentKit',
          version: '2.1.0'
        }
      }
    };

    this.sendMessage(response);
  }

  /**
   * Handle agent dispatch request
   * @param request - The dispatch request containing AgentRequest
   * @private
   */
  private async handleDispatch(request: MCPRequest): Promise<void> {
    if (!this.handler) {
      this.sendError(request.id, -32603, 'Internal error', 'No request handler registered');
      return;
    }

    if (!request.params || typeof request.params !== 'object') {
      this.sendError(request.id, -32602, 'Invalid params', 'Agent request parameters required');
      return;
    }

    try {
      // Extract AgentRequest from params - safe cast since we validate structure below
      const agentRequest = request.params as unknown as AgentRequest;
      
      // Validate the agent request structure
      if (!this.isValidAgentRequest(agentRequest)) {
        this.sendError(request.id, -32602, 'Invalid params', 'Invalid AgentRequest structure');
        return;
      }

      // Process the request through the handler
      const agentResponse: AgentResponse = await this.handler(agentRequest);

      // Send the response back - cast AgentResponse to JSONValue at protocol boundary
      const mcpResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: agentResponse as unknown as JSONValue // Safe: AgentResponse structure is JSON-serializable
      };

      this.sendMessage(mcpResponse);
    } catch (error) {
      this.sendError(
        request.id,
        -32603,
        'Internal error',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Validate AgentRequest structure
   * @param obj - Object to validate
   * @returns true if valid AgentRequest
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Need to validate unknown object structure
  private isValidAgentRequest(obj: any): obj is AgentRequest {
    if (!obj || typeof obj !== 'object') return false;
    const hasAgent = obj.agent && typeof obj.agent === 'object' &&
      typeof obj.agent.identifier === 'string' &&
      typeof obj.agent.name === 'string' &&
      typeof obj.agent.description === 'string' &&
      typeof obj.agent.prompt === 'string';
    const hasTools = Array.isArray(obj.tools);
    const hasServers = Array.isArray(obj.servers);
    const hasMessages = Array.isArray(obj.messages);
    const hasTrigger = obj.trigger && typeof obj.trigger === 'object' && !Array.isArray(obj.trigger);
    const hasExactlyOne = (hasMessages ? 1 : 0) + (hasTrigger ? 1 : 0) === 1;

    return Boolean(hasAgent && hasTools && hasServers && hasExactlyOne);
  }

  /**
   * Send server capabilities announcement
   * @private
   */
  private sendCapabilities(): void {
    const announcement = {
      jsonrpc: '2.0' as const,
      method: 'notifications/capabilities',
      params: {
        capabilities: {
          agents: {
            dispatch: true
          }
        }
      }
    };

    this.sendMessage(announcement);
  }

  /**
   * Send an error response
   * @param id - Request ID (null for parse errors)
   * @param code - Error code
   * @param message - Error message
   * @param data - Additional error data
   * @private
   */
  private sendError(id: string | number | null, code: number, message: string, data?: string): void {
    const errorResponse: MCPResponse = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    };

    this.sendMessage(errorResponse);
  }

  /**
   * Send a message to stdout
   * @param message - The message to send
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Need to send various message types
  private sendMessage(message: any): void {
    if (!this.isRunning) {
      return;
    }

    const messageStr = JSON.stringify(message) + '\n';
    process.stdout.write(messageStr);
  }
}
