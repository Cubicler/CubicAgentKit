// Minimal long-lived stdio agent example
// Run as a subprocess spawned by Cubicler using stdio transport.

import {
  CubicAgent,
  StdioAgentClient,
  StdioAgentServer,
  type AgentRequest,
  type AgentClient,
  type CallContext,
  type RawAgentResponse,
} from '../src/index.js';

async function main(): Promise<void> {
  // Configure longer timeouts if your tool calls may be slow.
  // Alternatively set process.env.DEFAULT_CALL_TIMEOUT (ms).
  const client = new StdioAgentClient({ timeoutMs: 120_000 });

  // Persistent server keeps the process alive until the parent kills it.
  const server = new StdioAgentServer({ persistent: true, keepAliveIntervalMs: 60_000 });

  const agent = new CubicAgent(client, server);

  await agent
    .start()
    .onMessage(async (request: AgentRequest, client: AgentClient, context: CallContext): Promise<RawAgentResponse> => {
      const last = request.messages?.[request.messages.length - 1];
      const content = last?.content ?? '';

      // Example: conditionally call a Cubicler MCP tool over stdio
      // Note: This uses the same stdio channel; no HTTP is involved.
      if (/servers/i.test(content)) {
        try {
          const servers = await client.callTool('cubicler_available_servers', {});
          const count = (servers as any)?.servers?.length ?? 0;
          return { type: 'text', content: `There are ${count} servers available. Tools used: ${context.toolCallCount}`, usedToken: 20 };
        } catch (err) {
          return { type: 'text', content: `Tool call failed: ${(err as Error).message}`, usedToken: 10 };
        }
      }

      return { type: 'text', content: `Echo: ${content}`, usedToken: 8 };
    })
    .listen();
}

// Keep stdout clean (only JSON-RPC lines should go to stdout). Use stderr for logging.
main().catch((err) => {
  // Don't exit; let the parent terminate if needed. Log to stderr.
  console.error('Agent startup error:', err);
});

