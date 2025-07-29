/**
 * Common types for JSON values used throughout the MCP protocol
 */
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

// Using type alias instead of interface to avoid empty interface warning
export type JSONArray = JSONValue[];

/**
 * Message sender information
 */
export interface MessageSender {
  id: string;
  name?: string; // optional
}

/**
 * Message structure for agent communication
 */
export interface Message {
  sender: MessageSender;
  timestamp?: string; // ISO 8601, optional
  type: 'text' | 'null'; // text (image/video support planned), null for no content
  content: string | null;
}

/**
 * Tool definition structure for agents
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONValue>;
    required?: string[];
  };
}

/**
 * Server information structure
 */
export interface ServerInfo {
  identifier: string;
  name: string;
  description: string;
}

/**
 * Agent information structure
 */
export interface AgentInfo {
  identifier: string;
  name: string;
  description: string;
  prompt: string;
}
