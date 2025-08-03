/**
 * Configuration for sentence-based memory system
 */
export interface MemoryConfig {
  shortTermMaxTokens: number;  // Maximum tokens in short-term memory (1 token = 1 word)
  defaultImportance: number;   // Default importance score for new memories (0-1)
}

/**
 * Internal memory item for storage
 */
export interface MemoryItem {
  id: string;
  sentence: string;
  importance: number;
  tags: string[];
  timestamp: number;
}

/**
 * Statistics for memory usage
 */
export interface MemoryStats {
  totalMemories: number;
  shortTermCount: number;
  shortTermTokens: number;
  shortTermMaxTokens: number;
  shortTermUtilization: number; // Percentage
}
