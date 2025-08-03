/**
 * Concrete memory class for sentence-based agent memories
 */
export class AgentMemory {
  constructor(
    public readonly id: string,
    public readonly sentence: string,
    public readonly importance: number,
    public readonly tags: string[]
  ) {}
}

/**
 * Search options for memory repository
 */
export interface MemorySearchOptions {
  content?: string;        // Exact text match in sentence
  contentRegex?: string;   // Regex pattern for sentence content
  tags?: string[];         // Exact tag matches (must have ALL these tags)
  tagsRegex?: string;      // Regex pattern for tags
  sortBy?: 'importance' | 'timestamp' | 'both';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Memory repository interface for sentence-based agent memories
 * Stores human-readable sentences about user preferences, facts, and context
 */
export interface MemoryRepository {
  /**
   * Store a sentence-based memory
   * Tags are mandatory and cannot be empty
   * @param sentence - The memory sentence (e.g., "John prefers direct communication")
   * @param importance - Importance score from 0-1 (uses config default if undefined)
   * @param tags - Memory tags (mandatory, cannot be empty)
   * @returns The memory ID
   */
  remember(sentence: string, importance: number | undefined, tags: string[]): Promise<string>;
  
  /**
   * Recall a specific memory by ID
   * @param id - Memory ID
   * @returns The memory object or null if not found
   */
  recall(id: string): Promise<AgentMemory | null>;
  
  /**
   * Search memories with flexible filtering and sorting
   * @param options - Search criteria and sorting options
   * @returns Array of matching memory objects
   */
  search(options: MemorySearchOptions): Promise<AgentMemory[]>;
  
  /**
   * Get short-term memories for prompt inclusion
   * Returns all memories within token-based capacity from config
   * @returns Array of short-term memory objects
   */
  getShortTermMemories(): AgentMemory[];
  
  /**
   * Add a memory to short-term storage (LRU management)
   * @param id - Memory ID to add to short-term
   * @returns True if added, false if memory not found
   */
  addToShortTermMemory(id: string): Promise<boolean>;
  
  /**
   * Edit the importance score of an existing memory
   * @param id - Memory ID
   * @param importance - New importance score (0-1)
   * @returns True if updated, false if memory not found
   */
  editImportance(id: string, importance: number): Promise<boolean>;
  
  /**
   * Edit the content of an existing memory
   * @param id - Memory ID
   * @param sentence - New memory sentence
   * @returns True if updated, false if memory not found
   */
  editContent(id: string, sentence: string): Promise<boolean>;
  
  /**
   * Add a tag to an existing memory
   * @param id - Memory ID
   * @param tag - Tag to add
   * @returns True if added, false if memory not found or tag already exists
   */
  addTag(id: string, tag: string): Promise<boolean>;
  
  /**
   * Remove a tag from an existing memory
   * Will throw error if removing tag would result in empty tags array
   * @param id - Memory ID
   * @param tag - Tag to remove
   * @returns True if removed, false if memory not found or tag doesn't exist
   */
  removeTag(id: string, tag: string): Promise<boolean>;
  
  /**
   * Replace all tags for an existing memory
   * Tags cannot be empty
   * @param id - Memory ID
   * @param tags - New tags array (cannot be empty)
   * @returns True if updated, false if memory not found
   */
  replaceTags(id: string, tags: string[]): Promise<boolean>;
  
  /**
   * Remove a memory completely
   * @param id - Memory ID
   * @returns True if deleted, false if not found
   */
  forget(id: string): Promise<boolean>;
}
