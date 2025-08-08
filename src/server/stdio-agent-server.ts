import { AgentServer, RequestHandler } from '../interface/agent-server.js';
import { AgentRequest } from '../model/agent-request.js';
import { AgentResponse } from '../model/agent-response.js';

import { MCPRequest, MCPResponse } from '../model/mcp.js';

/**
 * Message types used in stdio communication with Cubicler
 */
export type StdioMessage =
  | { type: 'agent_request'; data: AgentRequest }
  | { type: 'agent_response'; data: AgentResponse }
  | { type: 'mcp_request'; id: string; data: MCPRequest }
  | { type: 'mcp_response'; id: string; data: MCPResponse };

/**
 * Stdio implementation of AgentServer for handling requests from Cubicler
 * 
 * In the stdio protocol, Cubicler spawns this agent as a subprocess and sends
 * requests via stdin. The agent responds via stdout.
 */
export class StdioAgentServer implements AgentServer {
  private handler: RequestHandler | null = null;
  private isRunning = false;
  private buffer = '';

  /**
   * Creates a new StdioAgentServer
   */
  constructor() {
    // Set up graceful shutdown
    process.on('SIGINT', () => { void this.stop(); });
    process.on('SIGTERM', () => { void this.stop(); });
  }

  /**
   * Start the stdio server and register the request handler
   * Begins listening for agent requests on stdin
   */
  start(handler: RequestHandler): Promise<void> {
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

    return Promise.resolve();
  }

  /**
   * Stop the stdio server and clean up resources
   */
  stop(): Promise<void> {
    if (!this.isRunning) {
      return Promise.resolve();
    }

    this.isRunning = false;
    this.handler = null;
    
    // Clean up stdin listeners
    process.stdin.removeAllListeners('data');
    process.stdin.pause();
    
    return Promise.resolve();
  }

  /**
   * Handle incoming data from stdin
   */
  private handleInput(data: string): void {
    this.buffer += data;

    // Process complete JSON messages (one per line)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as StdioMessage;
          void this.handleMessage(message);
        } catch (error) {
          this.logError('Failed to parse message:', line, error);
        }
      }
    }
  }

  /**
   * Handle a parsed stdio message
   */
  private async handleMessage(message: StdioMessage): Promise<void> {
    try {
      if (message.type === 'agent_request') {
        await this.handleAgentRequest(message.data);
      }
      // Note: mcp_response messages are handled by StdioAgentClient
    } catch (error) {
      this.logError('Error handling message:', error);
    }
  }

  /**
   * Handle an agent request from Cubicler
   */
  private async handleAgentRequest(request: AgentRequest): Promise<void> {
    if (!this.handler) {
      this.logError('No handler registered for agent requests');
      return;
    }

    try {
      // Process the request through the handler
      const response = await this.handler(request);

      // Send the response back to Cubicler
      this.sendMessage({
        type: 'agent_response',
        data: response
      });
    } catch (error) {
      this.logError('Error processing agent request:', error);
      
      // Send error response
      this.sendMessage({
        type: 'agent_response',
        data: {
          timestamp: new Date().toISOString(),
          type: 'text',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          metadata: { usedToken: 0, usedTools: 0 }
        }
      });
    }
  }

  /**
   * Send a message to Cubicler via stdout
   */
  private sendMessage(message: StdioMessage): void {
    if (!this.isRunning) {
      return;
    }

    const messageStr = JSON.stringify(message) + '\n';
    process.stdout.write(messageStr);
  }

  /**
   * Log error messages to stderr (stdout is reserved for protocol messages)
   */
  private logError(...args: unknown[]): void {
    console.error('[StdioAgentServer]', ...args);
  }
}