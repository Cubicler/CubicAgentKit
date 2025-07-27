
/**
 * Generates a mandatory header that provides agent identity context
 * This helps the agent understand its role and distinguish its own messages from users
 */
export function generateAgentHeader(agentName: string): string {
  return `# Note\nYou are an agent with identifier "${agentName}". When you see messages with sender "${agentName}", those are your own previous responses. When you see sender "user", those are human user messages. Any other sender names represent other agents or custom entities.\n\n`;
}

/**
 * Prepends the mandatory agent header to the user prompt
 */
export function prependAgentHeader(
  agentName: string,
  originalPrompt: string
): string {
  const header = generateAgentHeader(agentName);
  return header + originalPrompt;
}
