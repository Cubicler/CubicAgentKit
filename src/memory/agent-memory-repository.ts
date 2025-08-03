import { MemoryRepository, AgentMemory, MemorySearchOptions } from '../interface/memory-repository.js';
import { PersistentMemory } from '../interface/persistent-memory.js';
import { ShortTermMemory } from '../interface/short-term-memory.js';
import { MemoryConfig, MemoryItem, MemoryStats } from '../model/memory.js';
import { 
  generateMemoryId, 
  validateMemoryInput, 
  validateTags,
  createDefaultMemoryConfig,
  matchesSearchCriteria,
  createSortComparator
} from '../utils/memory-utils.js';

/**
 * Main memory repository implementation for sentence-based agent memories
 * Handles the two-tier memory system with LRU short-term and persistent long-term storage
 */
export class AgentMemoryRepository implements MemoryRepository {
  private readonly config: MemoryConfig;

  /**
   * Create sentence memory repository
   * @param longTerm - Long-term memory store (database)
   * @param shortTerm - Short-term memory cache (LRU)
   * @param config - Memory configuration (optional)
   */
  constructor(
    private readonly longTerm: PersistentMemory,
    private readonly shortTerm: ShortTermMemory,
    config?: Partial<MemoryConfig>
  ) {
    this.config = { ...createDefaultMemoryConfig(), ...config };
  }

  /**
   * Initialize the memory system
   */
  async initialize(): Promise<void> {
    await this.longTerm.initialize();
  }

  /**
   * Store a sentence-based memory
   * Tags are mandatory and cannot be empty
   */
  async remember(sentence: string, importance: number | undefined, tags: string[]): Promise<string> {
    // Validate input
    const errors = validateMemoryInput(sentence, importance, tags);
    if (errors.length > 0) {
      throw new Error(`Invalid memory input: ${errors.join(', ')}`);
    }

    // Create memory object
    const memory: MemoryItem = {
      id: generateMemoryId(),
      sentence: sentence.trim(),
      importance: importance ?? this.config.defaultImportance,
      tags: tags.map(tag => tag.trim()),
      timestamp: Date.now()
    };

    // Store in long-term memory
    await this.longTerm.store(memory);

    // Add to short-term memory (may evict LRU)
    this.shortTerm.put(memory);
    
    return memory.id;
  }

  /**
   * Recall a specific memory by ID
   * Checks short-term first, then long-term
   * Moves to short-term if found in long-term
   */
  async recall(id: string): Promise<AgentMemory | null> {
    // Check short-term first (this will move to front if found)
    let memory = this.shortTerm.get(id);
    if (memory) {
      return memory;
    }

    // Check long-term
    memory = await this.longTerm.retrieve(id);
    if (memory) {
      // Move to short-term for faster future access
      const memoryItem: MemoryItem = {
        id: memory.id,
        sentence: memory.sentence,
        importance: memory.importance,
        tags: memory.tags,
        timestamp: Date.now() // Update access time
      };
      this.shortTerm.put(memoryItem);
      return memory;
    }

    return null;
  }

  /**
   * Search memories with flexible filtering and sorting
   * Searches both short-term and long-term, merges results
   */
  async search(options: MemorySearchOptions): Promise<AgentMemory[]> {
    // Search long-term storage
    const longTermResults = await this.longTerm.search(options);
    
    // Get short-term memories and filter them
    const shortTermMemories = this.shortTerm.getAll();
    const filteredShortTerm = shortTermMemories.filter((memory: AgentMemory) => 
      matchesSearchCriteria(memory, options)
    );
    
    // Create a map to avoid duplicates (short-term takes precedence)
    const memoryMap = new Map<string, AgentMemory>();
    
    // Add long-term results
    longTermResults.forEach((memory: AgentMemory) => {
      memoryMap.set(memory.id, memory);
    });
    
    // Add short-term results (overrides long-term if same ID)
    filteredShortTerm.forEach((memory: AgentMemory) => {
      memoryMap.set(memory.id, memory);
    });
    
    // Convert back to array and apply final sorting and limiting
    const results = Array.from(memoryMap.values());
    
    // Apply sorting (since we merged results, we need to re-sort)
    const sortBy = options.sortBy ?? 'both';
    const sortOrder = options.sortOrder ?? 'desc';
    const comparator = createSortComparator(sortBy, sortOrder);
    results.sort(comparator);
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    
    return results;
  }

  /**
   * Get short-term memories for prompt inclusion
   * Returns all memories within token-based capacity from config
   */
  getShortTermMemories(): AgentMemory[] {
    return this.shortTerm.getAll();
  }

  /**
   * Add a memory to short-term storage (LRU management)
   */
  async addToShortTermMemory(id: string): Promise<boolean> {
    // Check if already in short-term
    const existing = this.shortTerm.get(id);
    if (existing) {
      return true; // Already in short-term (moved to front by get())
    }

    // Retrieve from long-term
    const memory = await this.longTerm.retrieve(id);
    if (!memory) {
      return false; // Memory not found
    }

    // Add to short-term
    const memoryItem: MemoryItem = {
      id: memory.id,
      sentence: memory.sentence,
      importance: memory.importance,
      tags: memory.tags,
      timestamp: Date.now() // Update access time
    };
    this.shortTerm.put(memoryItem);
    return true;
  }

  /**
   * Edit the importance score of an existing memory
   */
  async editImportance(id: string, importance: number): Promise<boolean> {
    // Validate importance
    if (typeof importance !== 'number' || importance < 0 || importance > 1) {
      throw new Error('Importance must be a number between 0 and 1');
    }

    // Update in long-term storage
    const updated = await this.longTerm.update(id, { importance });
    if (!updated) {
      return false;
    }

    // Update in short-term if present
    const shortTermMemory = this.shortTerm.get(id);
    if (shortTermMemory) {
      const memoryItem: MemoryItem = {
        id: shortTermMemory.id,
        sentence: shortTermMemory.sentence,
        importance,
        tags: shortTermMemory.tags,
        timestamp: Date.now()
      };
      this.shortTerm.put(memoryItem);
    }

    return true;
  }

  /**
   * Edit the content of an existing memory
   */
  async editContent(id: string, sentence: string): Promise<boolean> {
    // Validate sentence
    if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
      throw new Error('Memory sentence is required and cannot be empty');
    }

    // Update in long-term storage
    const updated = await this.longTerm.update(id, { sentence: sentence.trim() });
    if (!updated) {
      return false;
    }

    // Update in short-term if present
    const shortTermMemory = this.shortTerm.get(id);
    if (shortTermMemory) {
      const memoryItem: MemoryItem = {
        id: shortTermMemory.id,
        sentence: sentence.trim(),
        importance: shortTermMemory.importance,
        tags: shortTermMemory.tags,
        timestamp: Date.now()
      };
      this.shortTerm.put(memoryItem);
    }

    return true;
  }

  /**
   * Add a tag to an existing memory
   */
  async addTag(id: string, tag: string): Promise<boolean> {
    // Validate tag
    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      throw new Error('Tag must be a non-empty string');
    }

    // Get current memory
    const memory = await this.longTerm.retrieve(id);
    if (!memory) {
      return false;
    }

    // Check if tag already exists
    const trimmedTag = tag.trim();
    if (memory.tags.includes(trimmedTag)) {
      return false; // Tag already exists
    }

    // Add tag
    const newTags = [...memory.tags, trimmedTag];
    const updated = await this.longTerm.update(id, { tags: newTags });
    if (!updated) {
      return false;
    }

    // Update in short-term if present
    const shortTermMemory = this.shortTerm.get(id);
    if (shortTermMemory) {
      const memoryItem: MemoryItem = {
        id: shortTermMemory.id,
        sentence: shortTermMemory.sentence,
        importance: shortTermMemory.importance,
        tags: newTags,
        timestamp: Date.now()
      };
      this.shortTerm.put(memoryItem);
    }

    return true;
  }

  /**
   * Remove a tag from an existing memory
   * Will throw error if removing tag would result in empty tags array
   */
  async removeTag(id: string, tag: string): Promise<boolean> {
    // Get current memory
    const memory = await this.longTerm.retrieve(id);
    if (!memory) {
      return false;
    }

    // Check if tag exists
    if (!memory.tags.includes(tag)) {
      return false; // Tag doesn't exist
    }

    // Check if removing would result in empty tags
    const newTags = memory.tags.filter((t: string) => t !== tag);
    if (newTags.length === 0) {
      throw new Error('Cannot remove tag - memory must have at least one tag');
    }

    // Update tags
    const updated = await this.longTerm.update(id, { tags: newTags });
    if (!updated) {
      return false;
    }

    // Update in short-term if present
    const shortTermMemory = this.shortTerm.get(id);
    if (shortTermMemory) {
      const memoryItem: MemoryItem = {
        id: shortTermMemory.id,
        sentence: shortTermMemory.sentence,
        importance: shortTermMemory.importance,
        tags: newTags,
        timestamp: Date.now()
      };
      this.shortTerm.put(memoryItem);
    }

    return true;
  }

  /**
   * Replace all tags for an existing memory
   * Tags cannot be empty
   */
  async replaceTags(id: string, tags: string[]): Promise<boolean> {
    // Validate tags
    const errors = validateTags(tags);
    if (errors.length > 0) {
      throw new Error(`Invalid tags: ${errors.join(', ')}`);
    }

    // Update in long-term storage
    const trimmedTags = tags.map(tag => tag.trim());
    const updated = await this.longTerm.update(id, { tags: trimmedTags });
    if (!updated) {
      return false;
    }

    // Update in short-term if present
    const shortTermMemory = this.shortTerm.get(id);
    if (shortTermMemory) {
      const memoryItem: MemoryItem = {
        id: shortTermMemory.id,
        sentence: shortTermMemory.sentence,
        importance: shortTermMemory.importance,
        tags: trimmedTags,
        timestamp: Date.now()
      };
      this.shortTerm.put(memoryItem);
    }

    return true;
  }

  /**
   * Remove a memory completely
   * Removes from both long-term and short-term storage
   */
  async forget(id: string): Promise<boolean> {
    // Remove from short-term
    this.shortTerm.remove(id);
    
    // Remove from long-term
    return await this.longTerm.delete(id);
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    const totalMemories = await this.longTerm.count();
    const shortTermCount = this.shortTerm.getAll().length;
    const shortTermTokens = this.shortTerm.getCurrentTokenCount();
    const shortTermMaxTokens = this.shortTerm.getMaxTokenCount();
    
    return {
      totalMemories,
      shortTermCount,
      shortTermTokens,
      shortTermMaxTokens,
      shortTermUtilization: shortTermMaxTokens > 0 ? (shortTermTokens / shortTermMaxTokens) * 100 : 0
    };
  }

  /**
   * Clear all short-term memory
   * Long-term memory remains intact
   */
  clearShortTerm(): void {
    this.shortTerm.clear();
  }

  /**
   * Close the memory system
   * Closes database connections
   */
  async close(): Promise<void> {
    await this.longTerm.close();
  }

  /**
   * Get memory configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }
}
