import { JSONValue } from '../model/types.js';

/**
 * Core memory structure
 */
export interface Memory {
  id: string;           // Unique identifier
  timestamp: number;    // Unix timestamp
  score: number;        // Importance score (0-1)
  tags: string[];       // Searchable tags
  body: JSONValue;      // Actual memory content
}

/**
 * Input for creating new memory (id and timestamp auto-generated)
 */
export interface MemoryInput {
  score?: number;       // Default: 0.5
  tags?: string[];      // Default: []
  body: JSONValue;      // Required
}

/**
 * Search query parameters
 */
export interface MemoryQuery {
  id?: string;                    // Exact ID match
  tags?: string[];               // Must contain all these tags
  tagsRegex?: string;            // Regex pattern for tags
  bodyRegex?: string;            // Regex pattern for body content
  scoreMin?: number;             // Minimum score
  scoreMax?: number;             // Maximum score
  timestampAfter?: number;       // Memories after this timestamp
  timestampBefore?: number;      // Memories before this timestamp
  limit?: number;                // Maximum results to return
  sortBy?: 'score' | 'timestamp' | 'both';  // Sort criteria
  sortOrder?: 'asc' | 'desc';    // Sort order
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  shortTermMaxWords: number;     // Word-based capacity limit for short-term
  defaultScore: number;          // Default score for new memories (0-1)
}

/**
 * Interface for long-term memory storage (database)
 */
export interface MemoryStore {
  /**
   * Initialize the storage (create tables, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Store a new memory
   */
  store(memory: Memory): Promise<Memory>;

  /**
   * Retrieve memory by ID
   */
  retrieve(id: string): Promise<Memory | null>;

  /**
   * Search memories with complex criteria
   */
  search(query: MemoryQuery): Promise<Memory[]>;

  /**
   * Update existing memory
   */
  update(id: string, updates: Partial<Omit<Memory, 'id'>>): Promise<Memory | null>;

  /**
   * Delete memory by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Get total count of memories
   */
  count(): Promise<number>;

  /**
   * Close storage connection
   */
  close(): Promise<void>;
}

/**
 * Interface for short-term memory (in-memory LRU)
 */
export interface ShortTermMemory {
  /**
   * Get memory from short-term cache
   */
  get(id: string): Memory | null;

  /**
   * Put memory in short-term cache (may evict LRU)
   */
  put(memory: Memory): Memory | null; // Returns evicted memory if any

  /**
   * Remove memory from short-term cache
   */
  remove(id: string): Memory | null;

  /**
   * Get all memories in short-term cache (for prompt inclusion)
   */
  getAll(): Memory[];

  /**
   * Get current word count in short-term cache
   */
  getCurrentWordCount(): number;

  /**
   * Get maximum word capacity
   */
  getMaxWordCount(): number;

  /**
   * Clear all short-term memory
   */
  clear(): void;
}

/**
 * Sort comparison function for memories
 */
export type MemorySortComparator = (a: Memory, b: Memory) => number;

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalMemories: number;
  shortTermCount: number;
  shortTermWordCount: number;
  shortTermMaxWords: number;
  shortTermUtilization: number; // Percentage
}