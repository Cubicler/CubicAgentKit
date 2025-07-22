import { AgentFunctionDefinition } from "./definitions";

// Forward declaration for circular dependency
export interface ICubiclerClient {
  getProviderSpec(providerName: string): Promise<ProviderSpecResponse>;
  executeFunction(functionName: string, parameters: JSONObject): Promise<FunctionCallResult>;
}

// Core configuration types
export interface AgentConfig {
  port: number;
  agentName: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  cubiclerClient: ICubiclerClient; // Required injection
}

// Options for injected Express app
export interface CubicAgentOptions {
  agentName: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  cubiclerClient: ICubiclerClient; // Required injection
}

// Request/Response types for Cubicler integration
export interface AgentRequest {
  prompt: string;
  providers: ProviderInfo[];
  messages: Message[];
}

export interface ProviderInfo {
  name: string;
  description: string;
}

export interface AgentResponse {
  message: string;
}

export interface Message {
  sender: string; // 'user' for users, agent name for agents
  content: string;
}

// Provider specification types
export interface ProviderSpecResponse {
  context: string;
  functions: AgentFunctionDefinition[];
}

// JSON types for type safety
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}
export type FunctionCallResult = JSONValue;

// Context and handler types
export interface CallContext {
  getProviderSpec(providerName: string): Promise<ProviderSpecResponse>;
  executeFunction(functionName: string, parameters: JSONObject): Promise<FunctionCallResult>;
}

export type CallHandler = (request: AgentRequest, context: CallContext) => Promise<string>;
