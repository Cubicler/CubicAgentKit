import { describe, it, expect, afterEach } from 'vitest';
import {
  AgentMemoryRepository,
  SQLiteMemory,
  LRUShortTermMemory,
  createDefaultMemoryRepository,
  createMemoryRepository,
  createSQLiteMemoryRepository,
  countWords,
  generateMemoryId,
  validateMemoryInput,
  validateTags,
  createSortComparator,
  matchesSearchCriteria,
  createDefaultMemoryConfig
} from '../../src/memory/memory-index.js';
import { AgentMemory } from '../../src/interface/memory-repository.js';
import fs from 'fs';

describe('Memory Index', () => {
  const createdRepositories: AgentMemoryRepository[] = [];

  afterEach(async () => {
    // Clean up all created repositories
    for (const repo of createdRepositories) {
      try {
        await repo.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    createdRepositories.length = 0;

    // Clean up any test database files
    const testDbFiles = ['./test-memories.db', './memories.db'];
    for (const file of testDbFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  });

  describe('exports', () => {
    it('should export all memory classes', () => {
      expect(AgentMemoryRepository).toBeDefined();
      expect(SQLiteMemory).toBeDefined();
      expect(LRUShortTermMemory).toBeDefined();
    });

    it('should export factory functions', () => {
      expect(createDefaultMemoryRepository).toBeDefined();
      expect(createMemoryRepository).toBeDefined();
      expect(createSQLiteMemoryRepository).toBeDefined();
    });

    it('should export utility functions', () => {
      expect(countWords).toBeDefined();
      expect(generateMemoryId).toBeDefined();
      expect(validateMemoryInput).toBeDefined();
      expect(validateTags).toBeDefined();
      expect(createSortComparator).toBeDefined();
      expect(matchesSearchCriteria).toBeDefined();
      expect(createDefaultMemoryConfig).toBeDefined();
    });
  });

  describe('createDefaultMemoryRepository', () => {
    it('should create repository with default parameters', async () => {
      const repository = await createDefaultMemoryRepository();
      createdRepositories.push(repository);

      expect(repository).toBeInstanceOf(AgentMemoryRepository);
      
      const config = repository.getConfig();
      expect(config.shortTermMaxTokens).toBe(2000);
      expect(config.defaultImportance).toBe(0.5);
    });

    it('should create repository with custom parameters', async () => {
      const repository = await createDefaultMemoryRepository(5000, 0.8);
      createdRepositories.push(repository);

      expect(repository).toBeInstanceOf(AgentMemoryRepository);
      
      const config = repository.getConfig();
      expect(config.shortTermMaxTokens).toBe(5000);
      expect(config.defaultImportance).toBe(0.8);
    });

    it('should create functional repository', async () => {
      const repository = await createDefaultMemoryRepository();
      createdRepositories.push(repository);

      const memoryId = await repository.remember('Test memory', 0.7, ['test']);
      const recalled = await repository.recall(memoryId);

      expect(recalled).not.toBeNull();
      expect(recalled?.sentence).toBe('Test memory');
      expect(recalled?.importance).toBe(0.7);
      expect(recalled?.tags).toContain('test');
    });
  });

  describe('createMemoryRepository', () => {
    it('should create repository with SQLite long-term storage', async () => {
      const longTerm = new SQLiteMemory(':memory:');
      const repository = await createMemoryRepository(longTerm);
      createdRepositories.push(repository);

      expect(repository).toBeInstanceOf(AgentMemoryRepository);
      
      const config = repository.getConfig();
      expect(config.shortTermMaxTokens).toBe(2000);
      expect(config.defaultImportance).toBe(0.5);
    });

    it('should create repository with custom parameters', async () => {
      const longTerm = new SQLiteMemory(':memory:');
      const repository = await createMemoryRepository(longTerm, 3000, 0.9);
      createdRepositories.push(repository);

      const config = repository.getConfig();
      expect(config.shortTermMaxTokens).toBe(3000);
      expect(config.defaultImportance).toBe(0.9);
    });

    it('should create functional repository with SQLite storage', async () => {
      const longTerm = new SQLiteMemory(':memory:');
      const repository = await createMemoryRepository(longTerm);
      createdRepositories.push(repository);

      const memoryId = await repository.remember('SQLite test memory', 0.6, ['sqlite', 'test']);
      const recalled = await repository.recall(memoryId);

      expect(recalled).not.toBeNull();
      expect(recalled?.sentence).toBe('SQLite test memory');
      expect(recalled?.importance).toBe(0.6);
      expect(recalled?.tags).toEqual(['sqlite', 'test']);
    });
  });

  describe('createSQLiteMemoryRepository', () => {
    it('should create repository with default SQLite file path', async () => {
      const repository = await createSQLiteMemoryRepository();
      createdRepositories.push(repository);

      expect(repository).toBeInstanceOf(AgentMemoryRepository);
      expect(fs.existsSync('./memories.db')).toBe(true);
    });

    it('should create repository with custom SQLite file path', async () => {
      const repository = await createSQLiteMemoryRepository('./test-memories.db');
      createdRepositories.push(repository);

      expect(repository).toBeInstanceOf(AgentMemoryRepository);
      expect(fs.existsSync('./test-memories.db')).toBe(true);
    });

    it('should create repository with custom parameters', async () => {
      const repository = await createSQLiteMemoryRepository('./test-memories.db', 4000, 0.7);
      createdRepositories.push(repository);

      const config = repository.getConfig();
      expect(config.shortTermMaxTokens).toBe(4000);
      expect(config.defaultImportance).toBe(0.7);
    });

    it('should create functional repository with persistent storage', async () => {
      const repository = await createSQLiteMemoryRepository('./test-memories.db');
      createdRepositories.push(repository);

      const memoryId = await repository.remember('Persistent memory', 0.8, ['persistent', 'file']);
      await repository.close();
      createdRepositories.pop(); // Remove from cleanup array since we closed it

      // Create new repository with same file to test persistence
      const repository2 = await createSQLiteMemoryRepository('./test-memories.db');
      createdRepositories.push(repository2);

      const recalled = await repository2.recall(memoryId);
      expect(recalled).not.toBeNull();
      expect(recalled?.sentence).toBe('Persistent memory');
      expect(recalled?.importance).toBe(0.8);
      expect(recalled?.tags).toContain('persistent');
      expect(recalled?.tags).toContain('file');
    });
  });

  describe('utility function exports', () => {
    it('should export working countWords function', () => {
      expect(countWords('hello world test')).toBe(3);
      expect(countWords('')).toBe(0);
      expect(countWords('single')).toBe(1);
    });

    it('should export working generateMemoryId function', () => {
      const id1 = generateMemoryId();
      const id2 = generateMemoryId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should export working validateMemoryInput function', () => {
      // Valid input
      expect(validateMemoryInput('valid sentence', 0.5, ['tag1'])).toEqual([]);
      
      // Invalid inputs
      expect(validateMemoryInput('', 0.5, ['tag1']).length).toBeGreaterThan(0);
      expect(validateMemoryInput('valid', -0.1, ['tag1']).length).toBeGreaterThan(0);
      expect(validateMemoryInput('valid', 0.5, []).length).toBeGreaterThan(0);
    });

    it('should export working validateTags function', () => {
      expect(validateTags(['valid', 'tags'])).toEqual([]);
      expect(validateTags([]).length).toBeGreaterThan(0);
      expect(validateTags(['', 'valid']).length).toBeGreaterThan(0);
    });

    it('should export working createSortComparator function', () => {
      const comparator = createSortComparator('importance', 'desc');
      expect(typeof comparator).toBe('function');
      
      const memory1 = new AgentMemory('1', 'test', 0.8, ['tag']);
      const memory2 = new AgentMemory('2', 'test', 0.6, ['tag']);
      
      expect(comparator(memory1, memory2)).toBeLessThan(0); // memory1 should come first
    });

    it('should export working matchesSearchCriteria function', () => {
      const memory = new AgentMemory('1', 'test sentence', 0.7, ['programming', 'test']);
      
      expect(matchesSearchCriteria(memory, {})).toBe(true); // No criteria = match all
      expect(matchesSearchCriteria(memory, { content: 'sentence' })).toBe(true);
      expect(matchesSearchCriteria(memory, { content: 'nonexistent' })).toBe(false);
      expect(matchesSearchCriteria(memory, { tags: ['programming'] })).toBe(true);
      expect(matchesSearchCriteria(memory, { tags: ['nonexistent'] })).toBe(false);
    });

    it('should export working createDefaultMemoryConfig function', () => {
      const config = createDefaultMemoryConfig();
      
      expect(config).toBeDefined();
      expect(typeof config.shortTermMaxTokens).toBe('number');
      expect(typeof config.defaultImportance).toBe('number');
      expect(config.shortTermMaxTokens).toBeGreaterThan(0);
      expect(config.defaultImportance).toBeGreaterThanOrEqual(0);
      expect(config.defaultImportance).toBeLessThanOrEqual(1);
    });
  });

  describe('integration tests', () => {
    it('should work with all memory system components together', async () => {
      const repository = await createDefaultMemoryRepository(1000, 0.6);
      createdRepositories.push(repository);

      // Store multiple memories
      const memoryIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = await repository.remember(`Memory ${i}`, 0.5 + (i * 0.1), [`tag${i}`, 'common']);
        memoryIds.push(id);
      }

      // Search with various criteria
      const allMemories = await repository.search({});
      expect(allMemories).toHaveLength(5);

      const taggedMemories = await repository.search({ tags: ['common'] });
      expect(taggedMemories).toHaveLength(5);

      const contentMemories = await repository.search({ content: 'Memory' });
      expect(contentMemories).toHaveLength(5);

      const limitedMemories = await repository.search({ limit: 3 });
      expect(limitedMemories).toHaveLength(3);

      // Test editing operations
      await repository.editImportance(memoryIds[0]!, 1.0);
      await repository.editContent(memoryIds[1]!, 'Updated content');
      await repository.addTag(memoryIds[2]!, 'newtag');

      // Verify edits
      const editedMemory = await repository.recall(memoryIds[0]!);
      expect(editedMemory?.importance).toBe(1.0);

      const contentEdited = await repository.recall(memoryIds[1]!);
      expect(contentEdited?.sentence).toBe('Updated content');

      const tagAdded = await repository.recall(memoryIds[2]!);
      expect(tagAdded?.tags).toContain('newtag');

      // Test stats
      const stats = await repository.getStats();
      expect(stats.totalMemories).toBe(5);
      expect(stats.shortTermCount).toBe(5);

      // Test forget
      await repository.forget(memoryIds[0]!);
      const forgottenMemory = await repository.recall(memoryIds[0]!);
      expect(forgottenMemory).toBeNull();

      const finalStats = await repository.getStats();
      expect(finalStats.totalMemories).toBe(4);
    });

    it('should handle error scenarios gracefully', async () => {
      const repository = await createDefaultMemoryRepository();
      createdRepositories.push(repository);

      // Test invalid operations
      await expect(repository.remember('', 0.5, ['tag'])).rejects.toThrow();
      await expect(repository.remember('valid', 2.0, ['tag'])).rejects.toThrow();
      await expect(repository.remember('valid', 0.5, [])).rejects.toThrow();

      // Test non-existent memory operations
      const result = await repository.recall('nonexistent-id');
      expect(result).toBeNull();

      const editResult = await repository.editImportance('nonexistent-id', 0.8);
      expect(editResult).toBe(false);

      const forgetResult = await repository.forget('nonexistent-id');
      expect(forgetResult).toBe(false);
    });
  });
});
