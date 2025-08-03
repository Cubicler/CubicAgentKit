// Sentence-based memory system exports
export { AgentMemoryRepository } from './agent-memory-repository.js';
export { SQLiteMemory } from './sqlite-memory.js';
export { LRUShortTermMemory } from './lru-short-term-memory.js';

// Import for internal use
import { AgentMemoryRepository } from './agent-memory-repository.js';
import { SQLiteMemory } from './sqlite-memory.js';
import { LRUShortTermMemory } from './lru-short-term-memory.js';

// Types and interfaces
export type {
  MemoryConfig,
  MemoryItem,
  MemoryStats
} from '../model/memory.js';

// Utilities
export {
  countWords,
  generateMemoryId,
  validateMemoryInput,
  validateTags,
  createSortComparator,
  matchesSearchCriteria,
  createDefaultMemoryConfig
} from '../utils/memory-utils.js';

/**
 * Create a default sentence-based memory setup with in-memory SQLite storage
 * @param maxTokens - Maximum tokens in short-term memory (default: 2000)
 * @param defaultImportance - Default importance score (default: 0.5)
 * @returns Configured sentence memory repository with in-memory SQLite storage
 */
export async function createDefaultMemoryRepository(
  maxTokens: number = 2000,
  defaultImportance: number = 0.5
): Promise<AgentMemoryRepository> {
  const longTerm = new SQLiteMemory(':memory:');
  const shortTerm = new LRUShortTermMemory(maxTokens);
  const repository = new AgentMemoryRepository(longTerm, shortTerm, {
    shortTermMaxTokens: maxTokens,
    defaultImportance
  });
  
  await repository.initialize();
  return repository;
}

/**
 * Create a production-ready memory setup with SQLite storage
 * @param dbPath - Path to SQLite database file (default: './memories.db')
 * @param maxTokens - Maximum tokens in short-term memory (default: 2000)
 * @param defaultImportance - Default importance score (default: 0.5)
 * @returns Configured sentence memory repository with SQLite storage
 */
export async function createSQLiteMemoryRepository(
  dbPath: string = './memories.db',
  maxTokens: number = 2000,
  defaultImportance: number = 0.5
): Promise<AgentMemoryRepository> {
  const longTerm = new SQLiteMemory(dbPath);
  const shortTerm = new LRUShortTermMemory(maxTokens);
  const repository = new AgentMemoryRepository(longTerm, shortTerm, {
    shortTermMaxTokens: maxTokens,
    defaultImportance
  });
  
  await repository.initialize();
  return repository;
}
