import { AgentClient } from '../interface/agent-client.js';
import { JSONValue, JSONObject } from '../model/types.js';
import { STDIORequest, STDIOResponse } from '../model/stdio.js';
import { createStdioLogger } from '../utils/logger.js';
import type { Logger } from 'pino';

/**
 * Stdio implementation of AgentClient for making JSON-RPC 2.0 MCP calls back to Cubicler
 * 
 * In the stdio protocol, the agent is spawned by Cubicler and communicates
 * via stdin/stdout using JSON-RPC 2.0. This client handles MCP calls back to Cubicler.
 */
export class StdioAgentClient implements AgentClient {
  private readonly pendingMcpRequests = new Map<string, {
    resolve: (value: JSONValue) => void;
    reject: (error: Error) => void;
  }>();
  private nextRequestId = 1;
  private readonly logger: Logger;

  /**
   * Creates a new StdioAgentClient
   * This client assumes it's running within a Cubicler-spawned subprocess
   */
  constructor() {
    this.logger = createStdioLogger();
    
    // Set up stdin listening for JSON-RPC responses
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
            const message = JSON.parse(line) as STDIOResponse;
            if ('jsonrpc' in message && 'id' in message) {
              this.handleJsonRpcResponse(message);
            }
          } catch (error) {
            this.logger.error({ line, error }, 'Failed to parse JSON-RPC response');
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
    return this.callJsonRpcMethod('tools/call', { name: toolName, arguments: parameters });
  }

  /**
   * Call any JSON-RPC 2.0 method through Cubicler
   */
  private async callJsonRpcMethod(method: string, params?: JSONObject): Promise<JSONValue> {
    const requestId = this.nextRequestId++;
    
    const jsonRpcRequest: STDIORequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params: params || {}
    };

    return new Promise((resolve, reject) => {
      // Store the request handlers
      this.pendingMcpRequests.set(requestId.toString(), { resolve, reject });

      // Send the JSON-RPC request to Cubicler
      this.sendJsonRpcMessage(jsonRpcRequest);

      // Set timeout for the request
      setTimeout(() => {
        const reqIdStr = requestId.toString();
        if (this.pendingMcpRequests.has(reqIdStr)) {
          this.pendingMcpRequests.delete(reqIdStr);
          reject(new Error(`JSON-RPC request timeout for method ${method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Handle incoming JSON-RPC 2.0 response
   */
  private handleJsonRpcResponse(response: STDIOResponse): void {
    const reqIdStr = response.id.toString();
    const pending = this.pendingMcpRequests.get(reqIdStr);
    if (!pending) {
      this.logger.error('Received JSON-RPC response for unknown request ID: %s', String(response.id));
      return;
    }

    this.pendingMcpRequests.delete(reqIdStr);

    if (response.error) {
      pending.reject(new Error(`JSON-RPC Error ${response.error.code}: ${response.error.message}`));
    } else {
      pending.resolve(response.result ?? null);
    }
  }

  /**
   * Send a JSON-RPC 2.0 message to Cubicler via stdout
   */
  private sendJsonRpcMessage(request: STDIORequest): void {
    const messageStr = JSON.stringify(request) + '\n';
    process.stdout.write(messageStr);
  }
}