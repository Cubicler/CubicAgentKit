import { AgentInfo, AgentTool, ServerInfo, Message } from './types.js';

/**
 * Agent request structure (copied from Cubicler)
 * This represents the complete request sent to an agent from Cubicler
 */
export interface AgentRequest {
  agent: AgentInfo;
  tools: AgentTool[];
  servers: ServerInfo[];
  messages: Message[];
}
