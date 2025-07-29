/**
 * MCP (Model Context Protocol) related types
 * Based on JSON-RPC 2.0 specification
 */

import { JSONValue, JSONObject } from './types.js';

/**
 * MCP Request structure following JSON-RPC 2.0
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  method: string;
  params?: JSONObject;
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
