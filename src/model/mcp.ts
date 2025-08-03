/**
 * MCP (Model Context Protocol) related types
 * Based on JSON-RPC 2.0 specification
 */

import { JSONValue, JSONObject } from './types.js';

/**
 * Minimal MCP message structure (for notifications and requests)
 */
export interface MinimalMCPRequest {
  jsonrpc: '2.0';
  method: string;
  params?: JSONObject;
}

/**
 * MCP Request structure following JSON-RPC 2.0 (extends MinimalMCPRequest with id)
 */
export interface MCPRequest extends MinimalMCPRequest {
  id: string | number;
}

/**
 * MCP Response structure following JSON-RPC 2.0
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  result?: JSONValue;
  error?: MCPError;
  id: string | number | null;
}

/**
 * MCP Error structure following JSON-RPC 2.0
 */
export interface MCPError {
  code: number;
  message: string;
  data?: JSONValue;
}

/**
 * Tool call parameters for MCP
 */
export interface MCPToolCall {
  name: string;
  parameters: JSONObject;
}
