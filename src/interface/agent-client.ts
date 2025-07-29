import { JSONValue, JSONObject } from '../model/types.js';

/**
 * Interface for AI provider integration and Cubicler MCP communication
 * This interface can be easily implemented and mocked for testing
 */
export interface AgentClient {
  /**
   * Initialize the client connection to Cubicler
   * This should set up HTTP client, validate endpoints, etc.
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Execute a tool call through Cubicler's MCP endpoint
   * @param toolName - The name of the tool to call (e.g., 'weather_service.get_current_weather')
   * @param parameters - The parameters to pass to the tool
   * @returns The result from the tool execution
   * @throws Error if the tool call fails or communication fails
   */
  callTool(toolName: string, parameters: JSONObject): Promise<JSONValue>;
}
