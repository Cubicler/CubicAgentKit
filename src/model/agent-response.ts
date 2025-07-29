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
