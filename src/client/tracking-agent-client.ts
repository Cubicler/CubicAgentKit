import { AgentClient } from '../interface/agent-client';
import { JSONObject, JSONValue } from '../model/types';

/**
 * Wrapper class that tracks tool calls for an AgentClient
 */
export class TrackingAgentClient implements AgentClient {
    private toolCallCount = 0;

    constructor(private readonly client: AgentClient) { }

    async initialize(): Promise<void> {
        return this.client.initialize();
    }

    async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
        this.toolCallCount++;
        return this.client.callTool(toolName, parameters);
    }

    getCallCount(): number {
        return this.toolCallCount;
    }
}
