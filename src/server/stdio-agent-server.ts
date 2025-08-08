import { AgentServer, RequestHandler } from '../interface/agent-server.js';
import { STDIODispatchRequest, STDIODispatchResponse } from '../model/stdio.js';
import { Logger, createStdioLogger } from '../utils/logger.js';

/**
 * Stdio implementation of AgentServer for handling JSON-RPC 2.0 requests from Cubicler
 * 
 * In the stdio protocol, Cubicler spawns this agent as a subprocess and sends
 * JSON-RPC 2.0 requests via stdin. The agent responds with JSON-RPC 2.0 responses via stdout.
 */
export class StdioAgentServer implements AgentServer {
  private handler: RequestHandler | null = null;
  private isRunning = false;
  private buffer = '';
  private readonly logger: Logger;

  /**
   * Creates a new StdioAgentServer
   */
  constructor() {
    this.logger = createStdioLogger();
    
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
          const message = JSON.parse(line) as STDIODispatchRequest | Record<string, unknown>;
          void this.handleMessage(message);
        } catch {
          // Silently ignore non-JSON lines (like log messages)
        }
      }
    }
  }

  /**
   * Handle a parsed JSON-RPC message
   */
  private async handleMessage(message: STDIODispatchRequest | Record<string, unknown>): Promise<void> {
    try {
      // Check if it's a valid JSON-RPC request
      if ('jsonrpc' in message && message.jsonrpc === '2.0' && 'method' in message && message.method === 'dispatch') {
        await this.handleJsonRpcRequest(message as STDIODispatchRequest);
      }
      // Ignore other message types silently (like log output)
    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  /**
   * Handle a JSON-RPC 2.0 request
   */
  private async handleJsonRpcRequest(request: STDIODispatchRequest): Promise<void> {
    if (!this.handler) {
      this.sendJsonRpcError(request.id, -32603, 'No handler registered for agent requests');
      return;
    }

    try {
      // Process the request through the handler
      const response = await this.handler(request.params);

      // Send JSON-RPC success response
      this.sendJsonRpcResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: response
      });
    } catch (error) {
      this.logger.error('Error processing JSON-RPC agent request:', error);
      
      // Send JSON-RPC error response
      this.sendJsonRpcError(
        request.id,
        -32000,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Send a JSON-RPC 2.0 success response
   */
  private sendJsonRpcResponse(response: STDIODispatchResponse): void {
    if (!this.isRunning) {
      return;
    }

    const responseStr = JSON.stringify(response) + '\n';
    process.stdout.write(responseStr);
  }

  /**
   * Send a JSON-RPC 2.0 error response
   */
  private sendJsonRpcError(id: string | number, code: number, message: string, data?: unknown): void {
    if (!this.isRunning) {
      return;
    }

    const errorResponse: STDIODispatchResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data }
    };

    const responseStr = JSON.stringify(errorResponse) + '\n';
    process.stdout.write(responseStr);
  }
}