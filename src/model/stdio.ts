import { JSONValue, JSONObject } from './types.js';
import { AgentRequest } from './agent.js';
import { AgentResponse } from "./agent.js";

/**
 * STDIO JSON-RPC 2.0 request structure
 */
export interface STDIORequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: JSONObject;
}

/**
 * STDIO JSON-RPC 2.0 response structure
 */
export interface STDIOResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: JSONValue;
  error?: STDIOError;
}

/**
 * STDIO JSON-RPC 2.0 error structure
 */
export interface STDIOError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * STDIO JSON-RPC 2.0 request specifically for agent dispatch
 */
export interface STDIODispatchRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'dispatch';
  params: AgentRequest;
}

/**
 * STDIO JSON-RPC 2.0 response specifically for agent responses
 */
export interface STDIODispatchResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: AgentResponse;
  error?: STDIOError;
}
