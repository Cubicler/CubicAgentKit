import { Memory, MemoryInput, MemoryQuery, MemoryStore, ShortTermMemory, MemoryConfig, MemoryStats } from './memory-types.js';
import { generateMemoryId, validateMemoryInput, createDefaultMemoryConfig } from './memory-utils.js';

/**
 * Main memory manager that orchestrates short-term and long-term memory
 * Handles the two-tier memory system with LRU short-term and persistent long-term storage
 */
export class AgentMemoryRepository {
  private readonly config: MemoryConfig;

  /**
   * Create agent memory manager
   * @param longTerm - Long-term memory store (database)
   * @param shortTerm - Short-term memory cache (LRU)
   * @param config - Memory configuration
   */
  constructor(
    private readonly longTerm: MemoryStore,
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
   * Store a new memory
   * Memory goes to both long-term and short-term storage
   * @param input - Memory content and metadata
   * @returns The created memory
   */
  async remember(input: MemoryInput): Promise<Memory> {
    // Validate input
    const errors = validateMemoryInput(input);
    if (errors.length > 0) {
      throw new Error(`Invalid memory input: ${errors.join(', ')}`);
    }

    // Create memory object
    const memory: Memory = {
      id: generateMemoryId(),
      timestamp: Date.now(),
      score: input.score ?? this.config.defaultScore,
      tags: input.tags ?? [],
      body: input.body
    };

    // Store in long-term memory
    await this.longTerm.store(memory);

    // Add to short-term memory (may evict LRU)
    this.shortTerm.put(memory);
    
    return memory;
  }

  /**
   * Recall a specific memory by ID
   * Checks short-term first, then long-term
   * Moves to short-term if found in long-term
   * @param id - Memory ID
   * @returns The memory or null if not found
   */
  async recall(id: string): Promise<Memory | null> {
    // Check short-term first (this will move to front if found)
    let memory = this.shortTerm.get(id);
    if (memory) {
      return memory;
    }

    // Check long-term
    memory = await this.longTerm.retrieve(id);
    if (memory) {
      // Move to short-term for faster future access
      this.shortTerm.put(memory);
      return memory;
    }

    return null;
  }

  /**
   * Search memories using complex criteria
   * Searches both short-term and long-term, merges results
   * @param query - Search criteria
   * @returns Matching memories
   */
  async search(query: MemoryQuery): Promise<Memory[]> {
    // Search long-term storage
    const longTermResults = await this.longTerm.search(query);
    
    // Get short-term memories
    const shortTermMemories = this.shortTerm.getAll();
    
    // Create a map to avoid duplicates (short-term takes precedence)
    const memoryMap = new Map<string, Memory>();
    
    // Add long-term results
    longTermResults.forEach(memory => {
      memoryMap.set(memory.id, memory);
    });
    
    // Add short-term results (overrides long-term if same ID)
    shortTermMemories.forEach(memory => {
      memoryMap.set(memory.id, memory);
    });
    
    // Convert back to array and apply client-side filtering if needed
    let results = Array.from(memoryMap.values());
    
    // Apply final filtering and sorting
    // (Note: Search already handles most filtering, but we may need additional client-side logic)
    
    return results;
  }

  /**
   * Update an existing memory
   * Updates both long-term and short-term if present
   * @param id - Memory ID
   * @param updates - Partial updates to apply
   * @returns Updated memory or null if not found
   */
  async update(id: string, updates: Partial<Omit<Memory, 'id'>>): Promise<Memory | null> {
    // Update in long-term storage
    const updated = await this.longTerm.update(id, updates);
    if (!updated) {
      return null;
    }

    // Update in short-term if present
    const shortTermMemory = this.shortTerm.get(id);
    if (shortTermMemory) {
      const updatedShortTerm = { ...shortTermMemory, ...updates, id };
      this.shortTerm.put(updatedShortTerm);
    }

    return updated;
  }

  /**
   * Delete a memory
   * Removes from both long-term and short-term storage
   * @param id - Memory ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    // Remove from short-term
    this.shortTerm.remove(id);
    
    // Remove from long-term
    return await this.longTerm.delete(id);
  }

  /**
   * Get all short-term memories (for prompt inclusion)
   * Returns memories in most-recently-used order
   * @returns Array of short-term memories
   */
  getShortTermMemories(): Memory[] {
    return this.shortTerm.getAll();
  }

  /**
   * Get memory statistics
   * @returns Current memory usage statistics
   */
  async getStats(): Promise<MemoryStats> {
    const totalMemories = await this.longTerm.count();
    const shortTermCount = this.shortTerm.getAll().length;
    const shortTermWordCount = this.shortTerm.getCurrentWordCount();
    const shortTermMaxWords = this.shortTerm.getMaxWordCount();
    
    return {
      totalMemories,
      shortTermCount,
      shortTermWordCount,
      shortTermMaxWords,
      shortTermUtilization: shortTermMaxWords > 0 ? (shortTermWordCount / shortTermMaxWords) * 100 : 0
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