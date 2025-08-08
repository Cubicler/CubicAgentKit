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
