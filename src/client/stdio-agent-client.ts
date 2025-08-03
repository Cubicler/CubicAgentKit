import { spawn, ChildProcess } from 'child_process';
import { AgentClient } from '../interface/agent-client.js';
import { JSONValue, JSONObject } from '../model/types.js';
import { MCPRequest, MCPResponse, MinimalMCPRequest } from '../model/mcp.js';

/**
 * Stdio-based implementation of AgentClient for MCP communication with cubicler server
 * Communicates with the cubicler MCP server via stdio using JSON-RPC 2.0 protocol
 */
export class StdioAgentClient implements AgentClient {
  private process: ChildProcess | null = null;
  private requestId: number = 1;
  private readonly pendingRequests = new Map<number, { resolve: (value: JSONValue) => void; reject: (error: Error) => void }>();
  private isInitialized = false;

  /**
   * Creates a new StdioAgentClient instance
   * @param command - The command to spawn the cubicler MCP server (e.g., 'npx', 'cubicler')
   * @param args - Arguments for the command (e.g., ['--server'])
   * @param cwd - Working directory for the process (optional)
   */
  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly cwd?: string
  ) {}

  /**
   * Initialize the client connection to the cubicler MCP server
   * Spawns the server process and establishes MCP communication
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Spawn the cubicler MCP server process
      this.process = spawn(this.command, this.args, {
        cwd: this.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        throw new Error('Failed to create stdio streams for cubicler process');
      }

      // Set up error handling
      this.process.on('error', (error) => {
        throw new Error(`Failed to spawn cubicler process: ${error.message}`);
      });

      this.process.on('exit', (code, signal) => {
        if (code !== 0) {
          console.error(`Cubicler process exited with code ${code} and signal ${signal}`);
        }
        this.cleanup();
      });

      // Set up stdout parsing for MCP responses
      let buffer = '';
      this.process.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();
        
        // Process complete JSON-RPC messages (one per line)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line) as MCPResponse;
              this.handleResponse(response);
            } catch (error) {
              console.error('Failed to parse MCP response:', line, error);
            }
          }
        }
      });

      // Set up stderr logging
      this.process.stderr.on('data', (data: Buffer) => {
        console.error('Cubicler stderr:', data.toString());
      });

      // Send MCP initialize request
      const initRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'CubicAgentKit',
            version: '2.1.0'
          }
        },
        id: this.requestId++,
      };

      await this.sendRequest(initRequest);
      
      // Send initialized notification
      const initializedNotification = {
        jsonrpc: '2.0' as const,
        method: 'notifications/initialized',
      };
      
      this.sendMessage(initializedNotification);
      
      this.isInitialized = true;
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to initialize StdioAgentClient: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a tool call through the cubicler MCP server
   * @param toolName - The name of the tool to call
   * @param parameters - The parameters to pass to the tool
   * @returns The result from the tool execution
   * @throws Error if the tool call fails or communication fails
   */
  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    if (!this.isInitialized) {
      throw new Error('StdioAgentClient not initialized. Call initialize() first.');
    }

    const mcpRequest: MCPRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters,
      },
      id: this.requestId++,
    };

    try {
      const result = await this.sendRequest(mcpRequest);
      
      // Handle MCP result - extract content from cubicler's response format
      if (result && typeof result === 'object' && 'content' in result) {
        const resultWithContent = result as { content: Array<{ type: string; text: string }> };
        const content = resultWithContent.content;
        if (Array.isArray(content) && content.length > 0 && content[0] && content[0].type === 'text') {
          // Try to parse the text content as JSON, fallback to raw text
          try {
            return JSON.parse(content[0].text) as JSONValue;
          } catch {
            return content[0].text;
          }
        }
      }

      // Return the raw result if it's not in the expected format
      return result ?? null;
    } catch (error) {
      throw new Error(`Tool call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send an MCP request and wait for the response
   * @param request - The MCP request to send
   * @returns Promise that resolves with the response result
   * @private
   */
  private async sendRequest(request: MCPRequest): Promise<JSONValue> {
    if (!this.process?.stdin) {
      throw new Error('Cubicler process not available');
    }

    return new Promise((resolve, reject) => {
      // Store the request handlers
      this.pendingRequests.set(request.id as number, { resolve, reject });

      // Send the request
      this.sendMessage(request);

      // Set timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(request.id as number)) {
          this.pendingRequests.delete(request.id as number);
          reject(new Error(`Request timeout for method ${request.method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Send a message to the cubicler process
   * @param message - The message to send
   * @private
   */
  private sendMessage(message: MinimalMCPRequest): void {
    if (!this.process?.stdin) {
      throw new Error('Cubicler process not available');
    }

    const messageStr = JSON.stringify(message) + '\n';
    this.process.stdin.write(messageStr);
  }

  /**
   * Handle incoming MCP response
   * @param response - The MCP response received
   * @private
   */
  private handleResponse(response: MCPResponse): void {
    if (response.id === null || response.id === undefined) {
      // This is a notification, ignore it
      return;
    }

    const pending = this.pendingRequests.get(response.id as number);
    if (!pending) {
      console.warn('Received response for unknown request ID:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id as number);

    if (response.error) {
      pending.reject(new Error(`MCP Error ${response.error.code}: ${response.error.message}`));
    } else {
      pending.resolve(response.result ?? null);
    }
  }

  /**
   * Clean up resources and terminate the cubicler process
   * @private
   */
  private cleanup(): void {
    // Reject all pending requests
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('Connection terminated'));
    }
    this.pendingRequests.clear();

    // Terminate the process (only if not already cleaning up)
    if (this.process && this.isInitialized) {
      const process = this.process;
      this.process = null;
      this.isInitialized = false;
      process.kill();
    }
  }

  /**
   * Gracefully shutdown the client and terminate the cubicler process
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface may require async in future
  async shutdown(): Promise<void> {
    this.cleanup();
  }
}