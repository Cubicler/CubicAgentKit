# CubicAgentKit Webhook Implementation Guide

## Overview

This guide explains how to implement webhook support in your CubicAgentKit agent. Agents must differentiate between regular dispatch calls (user conversations) and webhook calls (automated triggers) to provide appropriate responses.

This implementation uses the new builder pattern introduced in CubicAgentKit to separate message and trigger handlers while maintaining clean, type-safe code.

## Complete Implementation Example

```typescript
import {
  CubicAgent,
  HttpAgentClient,
  HttpAgentServer,
  createDefaultMemoryRepository,
  MessageHandler,
  TriggerHandler,
  AgentClient,
  CallContext,
  RawAgentResponse,
  MessageRequest,
  TriggerRequest
} from '@cubicler/cubicagentkit';

// Message handler for user conversations
const messageHandler: MessageHandler = async (request, client, context) => {
  const userMessages = request.messages;
  const lastMessage = userMessages[userMessages.length - 1];
  
  // Use memory from context if available
  if (context.memory) {
    await context.memory.remember(
      `User message: ${lastMessage.content}`, 
      0.7, 
      ['conversation', 'user-interaction']
    );
  }
  
  // Process user conversation
  const response = await processUserMessage(lastMessage.content, request, client);
  
  return {
    type: 'text',
    content: response,
    usedToken: 150
  };
};

// Trigger handler for webhook calls
const triggerHandler: TriggerHandler = async (request, client, context) => {
  const webhook = request.trigger;
  
  console.log(`Processing webhook: ${webhook.name} (${webhook.identifier})`);
  console.log(`Triggered at: ${webhook.triggeredAt}`);
  console.log(`Payload:`, webhook.payload);
  
  // Store webhook event in memory if available
  if (context.memory) {
    await context.memory.remember(
      `Webhook triggered: ${webhook.name} at ${webhook.triggeredAt}`, 
      0.8, 
      ['webhook', webhook.identifier, 'automated']
    );
  }
  
  // Process webhook data - this is NOT a conversation
  const response = await processWebhookTrigger(webhook, request, client);
  
  return {
    type: 'text',
    content: response,
    usedToken: 75
  };
};

// Setup and start agent
async function startAgent() {
  const client = new HttpAgentClient('http://localhost:1503');
  const server = new HttpAgentServer(3000, '/agent');
  const memory = await createDefaultMemoryRepository();
  const agent = new CubicAgent(client, server, memory);

  await agent.start()
    .onMessage(messageHandler)
    .onTrigger(triggerHandler)
    .listen();
    
  console.log('Agent started with webhook support');
}

startAgent().catch(console.error);
```

## Request Structure Changes

### Enhanced AgentRequest Interface

CubicAgentKit now includes built-in support for webhook requests. The `AgentRequest` interface has been updated to support both message and trigger requests:

```typescript
// Available in CubicAgentKit
import { AgentRequest, MessageRequest, TriggerRequest } from '@cubicler/cubicagentkit';

// Base AgentRequest - either messages OR trigger will be present, never both
interface AgentRequest {
  agent: AgentInfo;
  tools: AgentTool[];
  servers: ServerInfo[];
  messages?: Message[];     // Present for dispatch calls (user conversations)
  trigger?: {              // Present for webhook calls (automated triggers)
    type: 'webhook';
    identifier: string;    // Webhook identifier (e.g., "calendar-events")
    name: string;          // Human-readable name (e.g., "Calendar Events")
    description: string;   // Webhook description for context
    triggeredAt: string;   // ISO timestamp when webhook was received
    payload: JSONValue;          // Transformed webhook data (JSON-compatible)
  };
}

// Specialized request types for handlers
interface MessageRequest extends Omit<AgentRequest, 'messages' | 'trigger'> {
  messages: Message[];     // Always present, guaranteed non-empty
}

interface TriggerRequest extends Omit<AgentRequest, 'messages' | 'trigger'> {
  trigger: {              // Always present, guaranteed defined
    type: 'webhook';
    identifier: string;
    name: string;
    description: string;
    triggeredAt: string;
    payload: JSONValue;    // JSON-compatible webhook data
  };
}
```

## Implementation Requirements

### 1. Use Builder Pattern with Separate Handlers

CubicAgentKit provides a clean builder pattern to separate message and trigger handling:

```typescript
import { MessageHandler, TriggerHandler } from '@cubicler/cubicagentkit';

// Separate handlers with proper typing
const messageHandler: MessageHandler = async (request, client, context) => {
  // request is guaranteed to be MessageRequest with messages array
  const userMessages = request.messages; // TypeScript knows this is Message[]
  // ... handle user conversation
};

const triggerHandler: TriggerHandler = async (request, client, context) => {
  // request is guaranteed to be TriggerRequest with trigger object
  const webhook = request.trigger; // TypeScript knows this is defined
  // ... handle webhook trigger
};

// Configure agent with builder pattern
await agent.start()
  .onMessage(messageHandler)
  .onTrigger(triggerHandler)
  .listen();
```

### 2. Handler Registration and Error Handling

The builder pattern provides automatic request routing and error handling:

```typescript
// You can register just one handler type if needed
await agent.start()
  .onMessage(messageHandler) // Only handle messages
  .listen();

// Or both
await agent.start()
  .onMessage(messageHandler)
  .onTrigger(triggerHandler)
  .listen();

// If a request type comes in without a registered handler, 
// CubicAgentKit will automatically throw a descriptive error:
// "Received message request but no message handler was registered. Use onMessage() to register a handler."
// "Received trigger request but no trigger handler was registered. Use onTrigger() to register a handler."
```

### 3. Message Request Handling

For user conversations, implement the MessageHandler:

```typescript
import { MessageHandler, RawAgentResponse } from '@cubicler/cubicagentkit';

const messageHandler: MessageHandler = async (request, client, context) => {
  // request.messages is guaranteed to exist and be non-empty
  const userMessages = request.messages;
  const lastMessage = userMessages[userMessages.length - 1];
  
  // Use memory from context if available
  if (context.memory) {
    await context.memory.remember(
      `User message: ${lastMessage.content}`, 
      0.7, 
      ['conversation', 'user-interaction']
    );
  }
  
  // Process user conversation
  const response = await processUserMessage(lastMessage.content, request, client);
  
  return {
    type: 'text',
    content: response,
    usedToken: 150
  };
};
```

### 4. Trigger Request Handling

For automated triggers, implement the TriggerHandler:

```typescript
import { TriggerHandler, RawAgentResponse } from '@cubicler/cubicagentkit';

const triggerHandler: TriggerHandler = async (request, client, context) => {
  // request.trigger is guaranteed to exist
  const webhook = request.trigger;
  
  console.log(`Processing webhook: ${webhook.name} (${webhook.identifier})`);
  console.log(`Triggered at: ${webhook.triggeredAt}`);
  console.log(`Payload:`, webhook.payload);
  
  // Store webhook event in memory if available
  if (context.memory) {
    await context.memory.remember(
      `Webhook triggered: ${webhook.name} at ${webhook.triggeredAt}`, 
      0.8, 
      ['webhook', webhook.identifier, 'automated']
    );
  }
  
  // Process webhook data - this is NOT a conversation
  const response = await processWebhookTrigger(webhook, request, client);
  
  return {
    type: 'text',
    content: response,
    usedToken: 75
  };
};
```

## Webhook-Specific Behavior

### Key Differences from Dispatch

1. **No Conversation Context**: Webhooks are single events, not ongoing conversations
2. **Action-Oriented**: Focus on processing the event and taking appropriate action
3. **Structured Data**: Webhook payloads are structured data, not natural language
4. **Automated Response**: Response may trigger other systems, not just inform users

### Example Webhook Handlers

#### Calendar Event Handler

```typescript
import { TriggerHandler } from '@cubicler/cubicagentkit';

const calendarTriggerHandler: TriggerHandler = async (request, client, context) => {
  const webhook = request.trigger;
  
  // Handler-specific logic for calendar events
  if (webhook.identifier === 'calendar-events') {
    const event = webhook.payload.event;
    
    if (!event) {
      return {
        type: 'text',
        content: "⚠️ Calendar event data is missing",
        usedToken: 10
      };
    }
    
    const eventTime = new Date(event.start_time);
    const now = new Date();
    const minutesUntil = (eventTime.getTime() - now.getTime()) / (1000 * 60);
    
    let content: string;
    if (minutesUntil <= 15) {
      content = `🚨 URGENT: "${event.title}" starts in ${Math.round(minutesUntil)} minutes! Priority: ${event.priority}. ${event.description}`;
    } else {
      content = `📅 Upcoming: "${event.title}" at ${event.start_time}. Priority: ${event.priority}. ${event.description}`;
    }
    
    return {
      type: 'text',
      content,
      usedToken: 25
    };
  }
  
  // Default webhook handling
  return {
    type: 'text',
    content: `📡 Received webhook: ${webhook.name}`,
    usedToken: 15
  };
};
```

#### System Monitoring Handler

```typescript
const monitoringTriggerHandler: TriggerHandler = async (request, client, context) => {
  const webhook = request.trigger;
  
  if (webhook.identifier === 'system-monitoring') {
    const alert = webhook.payload.alert;
    
    let content: string;
    switch(alert.severity) {
      case 'Critical':
      case 'Emergency':
        content = `🔥 CRITICAL ALERT: ${alert.name} - ${alert.description}. Immediate action required!`;
        break;
      case 'Warning':
        content = `⚠️ WARNING: ${alert.name} - ${alert.description}. Please investigate.`;
        break;
      case 'Info':
        content = `ℹ️ INFO: ${alert.name} - ${alert.description}`;
        break;
      default:
        content = `📊 Alert: ${alert.name} - ${alert.description}`;
    }
    
    return {
      type: 'text',
      content,
      usedToken: 20
    };
  }
  
  return {
    type: 'text',
    content: `📡 Received webhook: ${webhook.name}`,
    usedToken: 15
  };
};
```

## Prompt Enhancement

### Webhook Context in Prompts

When handling webhooks, your agent receives an enhanced prompt:

```text
Your base agent prompt...

🔗 WEBHOOK CONTEXT:
- Source: Calendar Events (calendar-events)
- Description: Calendar event notifications and reminders from external calendar systems
- Triggered: 2025-08-07T14:00:00Z  
- You are responding to an automated webhook trigger, not a user conversation
```

Use this context to adjust your behavior:

```typescript
const triggerHandler: TriggerHandler = async (request, client, context) => {
  const webhook = request.trigger;
  
  // Check if prompt contains webhook context
  const isWebhookCall = request.agent.prompt.includes('WEBHOOK CONTEXT');
  
  if (isWebhookCall) {
    // Respond as an automated system
    const response = await generateAutomatedResponse(webhook, client);
    return {
      type: 'text',
      content: response,
      usedToken: 30
    };
  } else {
    // Fallback to normal processing
    const response = await generateNormalResponse(webhook, client);
    return {
      type: 'text',
      content: response,
      usedToken: 25
    };
  }
};
```

## Response Guidelines

### Webhook Response Characteristics

1. **Concise**: Webhook responses should be brief and actionable
2. **Structured**: Use emojis and formatting for clarity
3. **Action-Oriented**: Focus on what needs to be done
4. **Context-Aware**: Reference the webhook source and timing

### Good Webhook Response Examples

```typescript
// Calendar reminder
"📅 Meeting in 15 minutes: 'Team Standup' in Conference Room A. Agenda: Sprint review, blockers discussion."

// System alert  
"🔥 CRITICAL: Database CPU at 95%. Auto-scaling triggered. Monitor: https://dashboard.company.com/db-alerts"

// IoT sensor
"🌡️ Temperature alert: Server room reached 78°F at 14:30. HVAC adjustment recommended."
```

### Poor Webhook Response Examples

```typescript
// Too conversational
"Hi there! I see you have a meeting coming up. How are you feeling about it?"

// Too verbose
"I received a webhook notification from the calendar system at 2025-08-07T14:00:00Z regarding an upcoming meeting event. The meeting details include..."

// Lacks context
"Meeting soon."
```

## Error Handling

### Automatic Handler Validation

CubicAgentKit automatically handles common error scenarios:

```typescript
// If message request comes in but no message handler was registered
// CubicAgentKit throws: "Received message request but no message handler was registered. Use onMessage() to register a handler."

// If trigger request comes in but no trigger handler was registered  
// CubicAgentKit throws: "Received trigger request but no trigger handler was registered. Use onTrigger() to register a handler."

// If request has neither messages nor trigger
// CubicAgentKit throws: "Invalid request: neither messages nor trigger provided"
```

### Manual Validation in Handlers

You can add additional validation within your handlers:

```typescript
const triggerHandler: TriggerHandler = async (request, client, context) => {
  const webhook = request.trigger;
  
  // Validate webhook payload
  if (!webhook.payload) {
    return {
      type: 'text', 
      content: '❌ Webhook payload is missing or invalid',
      usedToken: 5
    };
  }
  
  // Validate specific payload structure
  if (webhook.identifier === 'calendar-events' && !webhook.payload.event) {
    return {
      type: 'text',
      content: '❌ Calendar event data is missing from webhook payload',
      usedToken: 10
    };
  }
  
  // Process valid webhook...
  const response = await processWebhookTrigger(webhook, request, client);
  return {
    type: 'text',
    content: response,
    usedToken: 50
  };
};
```

## Testing Your Implementation

### Sample Message Request

```json
{
  "agent": {
    "identifier": "test-agent",
    "name": "Test Agent", 
    "description": "Test agent for development",
    "prompt": "You are a helpful test agent."
  },
  "tools": [],
  "servers": [],
  "messages": [
    {
      "sender": {"id": "user123", "name": "Test User"},
      "type": "text",
      "content": "Hello, how are you?"
    }
  ]
}
```

### Sample Trigger Request

```json
{
  "agent": {
    "identifier": "test-agent",
    "name": "Test Agent",
    "description": "Test agent for development", 
    "prompt": "You are a helpful test agent.\n\n🔗 WEBHOOK CONTEXT:\n- Source: Test Webhook (test-webhook)\n- Description: Test webhook for development\n- Triggered: 2025-08-07T14:00:00Z\n- You are responding to an automated webhook trigger, not a user conversation"
  },
  "tools": [],
  "servers": [],
  "trigger": {
    "type": "webhook",
    "identifier": "test-webhook", 
    "name": "Test Webhook",
    "description": "Test webhook for development",
    "triggeredAt": "2025-08-07T14:00:00Z",
    "payload": {
      "test": "data",
      "timestamp": "2025-08-07T14:00:00Z"
    }
  }
}
```

### Unit Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CubicAgent, MessageHandler, TriggerHandler } from '@cubicler/cubicagentkit';

describe('Webhook Implementation', () => {
  let agent: CubicAgent;
  let messageHandler: MessageHandler;
  let triggerHandler: TriggerHandler;

  beforeEach(() => {
    messageHandler = vi.fn().mockResolvedValue({
      type: 'text',
      content: 'Message response',
      usedToken: 25
    });
    
    triggerHandler = vi.fn().mockResolvedValue({
      type: 'text', 
      content: 'Trigger response',
      usedToken: 15
    });
  });

  it('should handle message requests', async () => {
    await agent.start()
      .onMessage(messageHandler)
      .onTrigger(triggerHandler)
      .listen();
    
    // Test with message request...
    expect(messageHandler).toHaveBeenCalled();
  });
  
  it('should handle trigger requests', async () => {
    await agent.start()
      .onMessage(messageHandler)
      .onTrigger(triggerHandler)  
      .listen();
    
    // Test with trigger request...
    expect(triggerHandler).toHaveBeenCalled();
  });
});
```

## Checklist for Implementation

- [ ] Use builder pattern: `agent.start().onMessage(...).onTrigger(...).listen()`
- [ ] Implement `MessageHandler` for user conversations
- [ ] Implement `TriggerHandler` for webhook calls
- [ ] Use correct import: `@cubicler/cubicagentkit`
- [ ] Handle webhook context from enhanced prompt
- [ ] Generate appropriate responses for each type (conversational vs action-oriented)
- [ ] Add error handling within handlers if needed
- [ ] Test with both message and trigger request samples
- [ ] Ensure responses are action-oriented and concise for webhooks
- [ ] Validate webhook payload structure before processing if required

## Migration Notes

### From Previous Versions

If you have existing agent implementations using the old `DispatchHandler`:

1. **Breaking Change**: The `start(handler)` method now returns a builder
2. **New Pattern**: Use `start().onMessage().onTrigger().listen()`
3. **Type Safety**: Benefit from proper TypeScript typing with `MessageRequest` and `TriggerRequest`
4. **Error Handling**: Automatic validation and descriptive error messages
5. **Testing**: Use the new builder pattern in tests

### Legacy Support (Deprecated)

For temporary compatibility, you can use `startLegacy()` method, but this is deprecated:

```typescript
// DEPRECATED - Use builder pattern instead
await agent.startLegacy(oldDispatchHandler);
```

## Key Benefits of New Implementation

1. **Type Safety**: Separate `MessageHandler` and `TriggerHandler` types prevent runtime errors
2. **Clean Separation**: No need for manual request type detection
3. **Automatic Validation**: Built-in error handling for invalid requests
4. **Builder Pattern**: Fluent, readable configuration
5. **Maintainability**: Easier to test and extend individual handlers

This implementation enables your agent to seamlessly handle both user conversations and automated webhook triggers with appropriate context, strong typing, and clear separation of concerns.
