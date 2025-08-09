import { AgentServer, RequestHandler } from '../interface/agent-server.js';
import { STDIODispatchRequest, STDIODispatchResponse } from '../model/stdio.js';
import { createStdioLogger } from '../utils/logger.js';
import type { Logger } from 'pino';

/**
 * Stdio implementation of AgentServer for handling JSON-RPC 2.0 requests from Cubicler
 * 
 * In the stdio protocol, Cubicler spawns this agent as a subprocess and sends
 * JSON-RPC 2.0 requests via stdin. The agent responds with JSON-RPC 2.0 responses via stdout.
 */
export interface StdioAgentServerOptions {
  /** Keep the process alive with a timer even if streams go idle (default: true) */
  readonly persistent?: boolean;
  /** Interval in ms for keep-alive timer when persistent (default: 60_000) */
  readonly keepAliveIntervalMs?: number;
}

export class StdioAgentServer implements AgentServer {
  private handler: RequestHandler | null = null;
  private isRunning = false;
  private buffer = '';
  private readonly logger: Logger;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private readonly persistent: boolean;
  private readonly keepAliveIntervalMs: number;
  private static signalsRegistered = false;

  /**
   * Creates a new StdioAgentServer
   */
  constructor(options?: StdioAgentServerOptions) {
    this.logger = createStdioLogger();
    this.persistent = options?.persistent !== undefined ? options.persistent : true;
    this.keepAliveIntervalMs = options?.keepAliveIntervalMs ?? 60_000;
    
    // Set up graceful shutdown and resilience (register once per process)
    if (!StdioAgentServer.signalsRegistered) {
      process.on('SIGINT', () => { void this.stop(); });
      process.on('SIGTERM', () => { void this.stop(); });
      // Ignore SIGHUP to avoid accidental termination if controlling terminal goes away
      try { 
        process.on('SIGHUP', () => { /* intentionally empty - ignore SIGHUP */ }); 
      } catch { 
        /* ignore if SIGHUP not supported */ 
      }
      // Prevent hard crashes from tearing down the process immediately
      process.on('uncaughtException', (err) => {
        // Write to stderr directly to avoid interfering with stdout protocol
        console.error('StdioAgentServer uncaughtException:', err);
      });
      process.on('unhandledRejection', (reason) => {
        console.error('StdioAgentServer unhandledRejection:', reason);
      });
      // Avoid MaxListeners warnings when multiple instances exist in tests
      try { 
        process.setMaxListeners?.(Math.max(process.getMaxListeners?.() ?? 10, 50)); 
      } catch {
        // Silently ignore if setMaxListeners is not available or fails
      }
      StdioAgentServer.signalsRegistered = true;
    }
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
    process.stdin.on('error', (err: unknown) => {
      console.error('StdioAgentServer stdin error:', err);
    });
    if (typeof process.stdout.on === 'function') {
      process.stdout.on('error', (err: unknown) => {
        console.error('StdioAgentServer stdout error:', err);
      });
    }

    // Keep the process alive
    process.stdin.resume();
    if (this.persistent && !this.keepAliveTimer) {
      this.keepAliveTimer = setInterval(() => {
        // No-op; presence of timer keeps event loop alive even if streams go idle
      }, this.keepAliveIntervalMs);
    }

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
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    
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
      this.logger.error('Error handling message: %s', error instanceof Error ? error.message : String(error));
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
      this.logger.error('Error processing JSON-RPC agent request: %s', error instanceof Error ? error.message : String(error));
      
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
