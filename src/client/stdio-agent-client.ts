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
export interface StdioAgentClientOptions {
  /** Timeout for each JSON-RPC call in ms (defaults to env DEFAULT_CALL_TIMEOUT or 30000) */
  readonly timeoutMs?: number;
}

export class StdioAgentClient implements AgentClient {
  private readonly pendingMcpRequests = new Map<string, {
    resolve: (value: JSONValue) => void;
    reject: (error: Error) => void;
  }>();
  private nextRequestId = 1;
  private readonly logger: Logger;
  private readonly requestTimeoutMs: number;

  /**
   * Creates a new StdioAgentClient
   * This client assumes it's running within a Cubicler-spawned subprocess
   */
  constructor(options?: StdioAgentClientOptions) {
    this.logger = createStdioLogger();
    const envTimeout = Number.parseInt(process.env.DEFAULT_CALL_TIMEOUT || '', 10);
    this.requestTimeoutMs = Number.isFinite(envTimeout) && envTimeout > 0
      ? envTimeout
      : (options?.timeoutMs ?? 30000);
    
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

    // If stdin closes, fail any pending requests so callers can recover
    const failAllPending = (reason: string) => {
      for (const [id, pending] of this.pendingMcpRequests.entries()) {
        pending.reject(new Error(reason));
        this.pendingMcpRequests.delete(id);
      }
    };

    process.stdin.on('end', () => {
      failAllPending('StdioAgentClient: stdin stream ended');
    });
    process.stdin.on('close', () => {
      failAllPending('StdioAgentClient: stdin stream closed');
    });

    // Surface stdout errors for easier debugging in long-lived sessions
    process.stdout.on('error', (err: unknown) => {
      this.logger.error({ err }, 'StdioAgentClient: stdout error');
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
      }, this.requestTimeoutMs);
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
    // Best-effort write; in typical line-delimited usage this won't backpressure,
    // but if it does, allow Node to buffer and continue when drained.
    const ok = process.stdout.write(messageStr);
    if (!ok) {
      // Attach a one-time drain handler to log if backpressure occurs
      process.stdout.once('drain', () => {
        this.logger.debug?.('StdioAgentClient: stdout drain event');
      });
    }
  }
}
