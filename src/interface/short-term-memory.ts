import { AgentMemory } from './memory-repository.js';
import { MemoryItem } from '../model/memory.js';

/**
 * Interface for short-term memory cache with LRU eviction
 */
export interface ShortTermMemory {
  /**
   * Get memory from cache (should move to front if found for LRU)
   */
  get(id: string): AgentMemory | null;

  /**
   * Put memory in cache (may evict LRU items if over capacity)
   * @returns The evicted memory item if any, null otherwise
   */
  put(memory: MemoryItem): MemoryItem | null;

  /**
   * Remove memory from cache
   */
  remove(id: string): AgentMemory | null;

  /**
   * Get all memories in cache (most recently used first)
   */
  getAll(): AgentMemory[];

  /**
   * Get current token count
   */
  getCurrentTokenCount(): number;

  /**
   * Get maximum token capacity
   */
  getMaxTokenCount(): number;

  /**
   * Clear all memories from cache
   */
  clear(): void;
}
