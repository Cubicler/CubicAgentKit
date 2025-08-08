import { AgentInfo, AgentTool, ServerInfo, Message, JSONValue } from './types.js';

/**
 * Agent request structure (copied from Cubicler)
 * This represents the complete request sent to an agent from Cubicler
 * Either messages OR trigger will be present, never both
 */
export interface AgentRequest {
  agent: AgentInfo;
  tools: AgentTool[];
  servers: ServerInfo[];
  messages?: Message[];
  trigger?: {
    type: 'webhook';
    identifier: string;
    name: string;
    description: string;
    triggeredAt: string;
    payload: JSONValue;
  };
}

/**
 * Request structure for message-based interactions (user conversations)
 */
export interface MessageRequest extends Omit<AgentRequest, 'messages' | 'trigger'> {
  messages: Message[];
}

/**
 * Request structure for trigger-based interactions (webhook calls)
 */
export interface TriggerRequest extends Omit<AgentRequest, 'messages' | 'trigger'> {
  trigger: {
    type: 'webhook';
    identifier: string;
    name: string;
    description: string;
    triggeredAt: string;
    payload: JSONValue;
  };
}

/**
 * Response structure that implementers need to provide
 * The kit will automatically add timestamp and usedTools
 */
export interface RawAgentResponse {
  type: 'text' | 'null'; // text (image/video support planned), null for no content
  content: string | null;
  usedToken: number;
}

/**
 * Complete agent response structure (copied from Cubicler)
 * This represents the final response sent back to Cubicler with all metadata
 */

export interface AgentResponse {
  timestamp: string; // ISO 8601 format - added by the kit
  type: 'text' | 'null'; // text (image/video support planned), null for no content
  content: string | null;
  metadata: {
    usedToken: number; // Always provided by the kit (0 if not tracked by implementer)
    usedTools: number; // Always provided by the kit from tracking
  };
}

