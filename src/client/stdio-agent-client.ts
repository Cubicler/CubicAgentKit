import { AgentClient } from '../interface/agent-client.js';
import { JSONValue, JSONObject } from '../model/types.js';
import { MCPRequest, MCPResponse } from '../model/mcp.js';
import { AgentRequest } from '../model/agent-request.js';
import { AgentResponse } from '../model/agent-response.js';
import { randomUUID } from 'crypto';

/**
 * Message types used in stdio communication with Cubicler
 */
export type StdioMessage =
  | { type: 'agent_request'; data: AgentRequest }
  | { type: 'agent_response'; data: AgentResponse }
  | { type: 'mcp_request'; id: string; data: MCPRequest }
  | { type: 'mcp_response'; id: string; data: MCPResponse };

/**
 * Stdio implementation of AgentClient for making MCP calls back to Cubicler
 * 
 * In the stdio protocol, the agent is spawned by Cubicler and communicates
 * via stdin/stdout. This client handles MCP calls back to Cubicler.
 */
export class StdioAgentClient implements AgentClient {
  private readonly pendingMcpRequests = new Map<string, {
    resolve: (value: JSONValue) => void;
    reject: (error: Error) => void;
  }>();

  /**
   * Creates a new StdioAgentClient
   * This client assumes it's running within a Cubicler-spawned subprocess
   */
  constructor() {
    // Set up stdin listening for MCP responses
    process.stdin.setEncoding('utf8');
    let buffer = '';

    process.stdin.on('data', (data: string) => {
      buffer += data;

      // Process complete JSON messages (one per line)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line) as StdioMessage;
            if (message.type === 'mcp_response') {
              this.handleMcpResponse(message);
            }
          } catch (error) {
            this.logError('Failed to parse MCP response:', line, error);
          }
        }
      }
    });
  }

  /**
   * Initialize the client - no-op for stdio since connection is already established
   */
  async initialize(): Promise<void> {
    // No initialization needed - connection already established via spawn
  }

  /**
   * Execute a tool call through Cubicler via stdio
   */
  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    return this.callMcpMethod('tools/call', { name: toolName, arguments: parameters });
  }

  /**
   * Call any MCP method through Cubicler
   */
  private async callMcpMethod(method: string, params?: JSONObject): Promise<JSONValue> {
    const requestId = randomUUID();
    
    const mcpRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params: params || {}
    };

    return new Promise((resolve, reject) => {
      // Store the request handlers
      this.pendingMcpRequests.set(requestId, { resolve, reject });

      // Send the MCP request to Cubicler
      this.sendMessage({
        type: 'mcp_request',
        id: requestId,
        data: mcpRequest
      });

      // Set timeout for the request
      setTimeout(() => {
        if (this.pendingMcpRequests.has(requestId)) {
          this.pendingMcpRequests.delete(requestId);
          reject(new Error(`MCP request timeout for method ${method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Handle incoming MCP response
   */
  private handleMcpResponse(message: { id: string; data: MCPResponse }): void {
    const pending = this.pendingMcpRequests.get(message.id);
    if (!pending) {
      this.logError('Received MCP response for unknown request ID:', message.id);
      return;
    }

    this.pendingMcpRequests.delete(message.id);

    if (message.data.error) {
      pending.reject(new Error(`MCP Error ${message.data.error.code}: ${message.data.error.message}`));
    } else {
      pending.resolve(message.data.result ?? null);
    }
  }

  /**
   * Send a message to Cubicler via stdout
   */
  private sendMessage(message: StdioMessage): void {
    const messageStr = JSON.stringify(message) + '\n';
    process.stdout.write(messageStr);
  }

  /**
   * Log error messages to stderr (stdout is reserved for protocol messages)
   */
  private logError(...args: unknown[]): void {
    console.error('[StdioAgentClient]', ...args);
  }
}