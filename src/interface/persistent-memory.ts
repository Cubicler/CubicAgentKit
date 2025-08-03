import { AgentMemory, MemorySearchOptions } from './memory-repository.js';
import { MemoryItem } from '../model/memory.js';

/**
 * Interface for persistent long-term memory storage
 */
export interface PersistentMemory {
  /**
   * Initialize the persistent storage (e.g., database connection)
   */
  initialize(): Promise<void>;

  /**
   * Store a memory item persistently
   */
  store(memory: MemoryItem): Promise<void>;

  /**
   * Retrieve a memory by ID
   */
  retrieve(id: string): Promise<AgentMemory | null>;

  /**
   * Search memories with filtering and sorting options
   */
  search(options: MemorySearchOptions): Promise<AgentMemory[]>;

  /**
   * Update specific fields of an existing memory
   */
  update(id: string, updates: Partial<Pick<MemoryItem, 'sentence' | 'importance' | 'tags'>>): Promise<boolean>;

  /**
   * Delete a memory permanently
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count total memories in storage
   */
  count(): Promise<number>;

  /**
   * Close the storage connection
   */
  close(): Promise<void>;
}
