// Memory system exports
export { AgentMemoryRepository as AgentMemoryManager } from './agent-memory-repository.js';
export { LRUShortTermMemory } from './lru-short-term-memory.js';
export { SQLiteMemoryStore } from './sqlite-memory-store.js';
export { MemoryMCPTools } from './memory-mcp-tools.js';

// Types and interfaces
export type {
  Memory,
  MemoryInput,
  MemoryQuery,
  MemoryConfig,
  MemoryStore,
  ShortTermMemory,
  MemoryStats,
  MemorySortComparator
} from './memory-types.js';

// Utilities
export {
  countWords,
  generateMemoryId,
  createSortComparator,
  matchesQuery,
  validateMemoryInput,
  createDefaultMemoryConfig
} from './memory-utils.js';

/**
 * Create a default memory setup with SQLite storage
 * @param dbPath - Path to SQLite database (defaults to in-memory)
 * @param shortTermMaxWords - Maximum words in short-term memory
 * @returns Configured memory manager
 */
export async function createDefaultMemoryManager(
  dbPath?: string,
  shortTermMaxWords: number = 2000
) {
  const { SQLiteMemoryStore } = await import('./sqlite-memory-store.js');
  const { LRUShortTermMemory } = await import('./lru-short-term-memory.js');
  const { AgentMemoryRepository } = await import('./agent-memory-repository.js');

  const longTerm = new SQLiteMemoryStore(dbPath);
  const shortTerm = new LRUShortTermMemory(shortTermMaxWords);
  const manager = new AgentMemoryRepository(longTerm, shortTerm, { shortTermMaxWords });
  
  await manager.initialize();
  return manager;
}