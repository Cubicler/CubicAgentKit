import { AgentBuilder, MessageHandler, TriggerHandler, DispatchHandler } from '../interface/agent-server';
import { MessageRequest, TriggerRequest } from '../model/agent-request';
import { CubicAgent } from './cubic-agent';

/**
 * Internal builder implementation for CubicAgent
 */
export class CubicAgentBuilder implements AgentBuilder {
  private messageHandler?: MessageHandler;
  private triggerHandler?: TriggerHandler;
  private hasStarted = false;

  constructor(
    private readonly agent: CubicAgent
  ) { }

  onMessage(handler: MessageHandler): AgentBuilder {
    this.messageHandler = handler;
    return this;
  }

  onTrigger(handler: TriggerHandler): AgentBuilder {
    this.triggerHandler = handler;
    return this;
  }

  async listen(): Promise<void> {
    if (this.hasStarted) {
      throw new Error('Agent server has already been started. Cannot call listen() multiple times.');
    }

    this.hasStarted = true;

    // Create the unified handler that routes to appropriate handlers
    const unifiedHandler: DispatchHandler = async (request, client, context) => {
      // Check if this is a message request
      if ('messages' in request && request.messages) {
        if (!this.messageHandler) {
          throw new Error('Received message request but no message handler was registered. Use onMessage() to register a handler.');
        }
        return await this.messageHandler(request as MessageRequest, client, context);
      }

      // Check if this is a trigger request
      if ('trigger' in request && request.trigger) {
        if (!this.triggerHandler) {
          throw new Error('Received trigger request but no trigger handler was registered. Use onTrigger() to register a handler.');
        }
        return await this.triggerHandler(request as TriggerRequest, client, context);
      }

      // Invalid request structure
      throw new Error('Invalid request: neither messages nor trigger provided');
    };

    await this.agent.startWithHandler(unifiedHandler);

    // Store the unified handler for later use in dispatch calls
    this.agent.setUnifiedHandler(unifiedHandler);
  }
}
