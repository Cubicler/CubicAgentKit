import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SQLiteMemory } from '../../src/memory/sqlite-memory.js';
import { AgentMemory } from '../../src/interface/memory-repository.js';
import { MemoryItem } from '../../src/model/memory.js';
import fs from 'fs';
import path from 'path';

describe('SQLiteMemory', () => {
  let memory: SQLiteMemory;
  let tempDbPath: string;

  beforeEach(async () => {
    // Use in-memory database for most tests
    memory = new SQLiteMemory(':memory:');
    await memory.initialize();
  });

  afterEach(async () => {
    await memory.close();
    
    // Clean up temp file if it exists
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  describe('constructor and initialization', () => {
    it('should create instance with in-memory database by default', () => {
      const mem = new SQLiteMemory();
      expect(mem.getDatabasePath()).toBe(':memory:');
      expect(mem.isInitialized()).toBe(false);
    });

    it('should create instance with specified database path', () => {
      const dbPath = '/tmp/test.db';
      const mem = new SQLiteMemory(dbPath);
      expect(mem.getDatabasePath()).toBe(dbPath);
      expect(mem.isInitialized()).toBe(false);
    });

    it('should initialize database and create tables', async () => {
      const mem = new SQLiteMemory(':memory:');
      await mem.initialize();
      expect(mem.isInitialized()).toBe(true);
      await mem.close();
    });

    it('should create file-based database', async () => {
      tempDbPath = path.join(__dirname, 'test-memory.db');
      const mem = new SQLiteMemory(tempDbPath);
      await mem.initialize();
      
      expect(fs.existsSync(tempDbPath)).toBe(true);
      expect(mem.isInitialized()).toBe(true);
      
      await mem.close();
    });
  });

  describe('store and retrieve', () => {
    it('should store and retrieve a simple memory', async () => {
      const memoryItem: MemoryItem = {
        id: 'test-1',
        sentence: 'Test memory sentence',
        importance: 0.8,
        timestamp: Date.now(),
        tags: ['test', 'simple']
      };

      await memory.store(memoryItem);
      const retrieved = await memory.retrieve('test-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('test-1');
      expect(retrieved?.sentence).toBe('Test memory sentence');
      expect(retrieved?.importance).toBe(0.8);
      expect(retrieved?.tags).toEqual(['simple', 'test']); // SQLite orders alphabetically
    });

    it('should return null for non-existent memory', async () => {
      const retrieved = await memory.retrieve('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should store memory with no tags', async () => {
      const memoryItem: MemoryItem = {
        id: 'test-no-tags',
        sentence: 'Memory with no tags',
        importance: 0.5,
        timestamp: Date.now(),
        tags: []
      };

      await memory.store(memoryItem);
      const retrieved = await memory.retrieve('test-no-tags');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.tags).toEqual([]);
    });

    it('should handle duplicate tag insertion', async () => {
      const memoryItem1: MemoryItem = {
        id: 'test-1',
        sentence: 'First memory',
        importance: 0.5,
        timestamp: Date.now(),
        tags: ['common-tag', 'unique1']
      };

      const memoryItem2: MemoryItem = {
        id: 'test-2',
        sentence: 'Second memory',
        importance: 0.7,
        timestamp: Date.now(),
        tags: ['common-tag', 'unique2']
      };

      await memory.store(memoryItem1);
      await memory.store(memoryItem2);

      const retrieved1 = await memory.retrieve('test-1');
      const retrieved2 = await memory.retrieve('test-2');

      expect(retrieved1?.tags).toContain('common-tag');
      expect(retrieved2?.tags).toContain('common-tag');
    });

    it('should throw error when storing to uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      const memoryItem: MemoryItem = {
        id: 'test',
        sentence: 'Test',
        importance: 0.5,
        timestamp: Date.now(),
        tags: []
      };

      await expect(uninitMemory.store(memoryItem)).rejects.toThrow('SQLiteMemory not initialized');
    });

    it('should throw error when retrieving from uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      await expect(uninitMemory.retrieve('test')).rejects.toThrow('SQLiteMemory not initialized');
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      // Add test data
      const testMemories: MemoryItem[] = [
        {
          id: 'mem-1',
          sentence: 'The quick brown fox jumps over the lazy dog',
          importance: 0.9,
          timestamp: 1000,
          tags: ['animals', 'famous']
        },
        {
          id: 'mem-2', 
          sentence: 'JavaScript is a programming language',
          importance: 0.7,
          timestamp: 2000,
          tags: ['programming', 'web']
        },
        {
          id: 'mem-3',
          sentence: 'SQLite is a lightweight database',
          importance: 0.8,
          timestamp: 3000,
          tags: ['database', 'sqlite']
        },
        {
          id: 'mem-4',
          sentence: 'Testing is important for software quality',
          importance: 0.6,
          timestamp: 4000,
          tags: ['testing', 'quality']
        }
      ];

      for (const mem of testMemories) {
        await memory.store(mem);
      }
    });

    it('should search by content', async () => {
      const results = await memory.search({ content: 'JavaScript' });
      expect(results).toHaveLength(1);
      expect(results[0]?.sentence).toContain('JavaScript');
    });

    it('should search by content regex', async () => {
      const results = await memory.search({ contentRegex: '[Jj]ava[Ss]cript|SQLite' });
      expect(results).toHaveLength(2);
    });

    it('should search by exact tags', async () => {
      const results = await memory.search({ tags: ['programming'] });
      expect(results).toHaveLength(1);
      expect(results[0]?.tags).toContain('programming');
    });

    it('should search by multiple tags', async () => {
      const results = await memory.search({ tags: ['programming', 'database'] });
      expect(results).toHaveLength(2);
    });

    it('should search by tag regex', async () => {
      const results = await memory.search({ tagsRegex: 'program.*' });
      expect(results).toHaveLength(1);
      expect(results[0]?.tags).toContain('programming');
    });

    it('should sort by importance desc (default)', async () => {
      const results = await memory.search({});
      expect(results).toHaveLength(4);
      expect(results[0]?.importance).toBe(0.9);
      expect(results[1]?.importance).toBe(0.8);
    });

    it('should sort by importance asc', async () => {
      const results = await memory.search({ 
        sortBy: 'importance', 
        sortOrder: 'asc' 
      });
      expect(results[0]?.importance).toBe(0.6);
      expect(results[3]?.importance).toBe(0.9);
    });

    it('should sort by timestamp desc', async () => {
      const results = await memory.search({ 
        sortBy: 'timestamp', 
        sortOrder: 'desc' 
      });
      expect(results[0]?.id).toBe('mem-4'); // timestamp 4000
      expect(results[3]?.id).toBe('mem-1'); // timestamp 1000
    });

    it('should sort by timestamp asc', async () => {
      const results = await memory.search({ 
        sortBy: 'timestamp', 
        sortOrder: 'asc' 
      });
      expect(results[0]?.id).toBe('mem-1'); // timestamp 1000
      expect(results[3]?.id).toBe('mem-4'); // timestamp 4000
    });

    it('should limit results', async () => {
      const results = await memory.search({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should combine multiple search criteria', async () => {
      const results = await memory.search({
        content: 'is',
        sortBy: 'importance',
        sortOrder: 'desc',
        limit: 1
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('mem-3'); // SQLite importance 0.8
    });

    it('should return empty array when no matches found', async () => {
      const results = await memory.search({ content: 'nonexistent' });
      expect(results).toHaveLength(0);
    });

    it('should handle invalid regex gracefully', async () => {
      const results = await memory.search({ contentRegex: '[invalid' });
      expect(results).toHaveLength(0);
    });

    it('should throw error when searching uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      await expect(uninitMemory.search({})).rejects.toThrow('SQLiteMemory not initialized');
    });
  });

  describe('update functionality', () => {
    beforeEach(async () => {
      const memoryItem: MemoryItem = {
        id: 'update-test',
        sentence: 'Original sentence',
        importance: 0.5,
        timestamp: 1000,
        tags: ['original', 'test']
      };
      await memory.store(memoryItem);
    });

    it('should update sentence', async () => {
      const result = await memory.update('update-test', {
        sentence: 'Updated sentence'
      });

      expect(result).toBe(true);
      const retrieved = await memory.retrieve('update-test');
      expect(retrieved?.sentence).toBe('Updated sentence');
    });

    it('should update importance', async () => {
      const result = await memory.update('update-test', {
        importance: 0.9
      });

      expect(result).toBe(true);
      const retrieved = await memory.retrieve('update-test');
      expect(retrieved?.importance).toBe(0.9);
    });

    it('should update tags', async () => {
      const result = await memory.update('update-test', {
        tags: ['new', 'updated', 'tags']
      });

      expect(result).toBe(true);
      const retrieved = await memory.retrieve('update-test');
      expect(retrieved?.tags).toEqual(['new', 'tags', 'updated']);
    });

    it('should update multiple fields at once', async () => {
      const result = await memory.update('update-test', {
        sentence: 'New sentence',
        importance: 0.8,
        tags: ['multiple', 'fields']
      });

      expect(result).toBe(true);
      const retrieved = await memory.retrieve('update-test');
      expect(retrieved?.sentence).toBe('New sentence');
      expect(retrieved?.importance).toBe(0.8);
      expect(retrieved?.tags).toEqual(['fields', 'multiple']);
    });

    it('should return false for non-existent memory', async () => {
      const result = await memory.update('non-existent', {
        sentence: 'Should not work'
      });

      expect(result).toBe(false);
    });

    it('should return false when no updates provided', async () => {
      const result = await memory.update('update-test', {});
      expect(result).toBe(false);
    });

    it('should throw error when updating uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      await expect(uninitMemory.update('test', { sentence: 'test' }))
        .rejects.toThrow('SQLiteMemory not initialized');
    });
  });

  describe('delete functionality', () => {
    beforeEach(async () => {
      const memoryItem: MemoryItem = {
        id: 'delete-test',
        sentence: 'To be deleted',
        importance: 0.5,
        timestamp: Date.now(),
        tags: ['delete', 'test']
      };
      await memory.store(memoryItem);
    });

    it('should delete existing memory', async () => {
      const result = await memory.delete('delete-test');
      expect(result).toBe(true);

      const retrieved = await memory.retrieve('delete-test');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent memory', async () => {
      const result = await memory.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should clean up orphaned tags after deletion', async () => {
      // Store another memory with different tags
      const otherMemory: MemoryItem = {
        id: 'other',
        sentence: 'Other memory',
        importance: 0.5,
        timestamp: Date.now(),
        tags: ['other', 'different']
      };
      await memory.store(otherMemory);

      // Delete first memory
      await memory.delete('delete-test');

      // Search for tags - should not find 'delete' or 'test' tags
      const results = await memory.search({ tags: ['delete'] });
      expect(results).toHaveLength(0);
    });

    it('should throw error when deleting from uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      await expect(uninitMemory.delete('test')).rejects.toThrow('SQLiteMemory not initialized');
    });
  });

  describe('count functionality', () => {
    it('should return 0 for empty database', async () => {
      const count = await memory.count();
      expect(count).toBe(0);
    });

    it('should return correct count after adding memories', async () => {
      const memoryItems = [
        { id: '1', sentence: 'First', importance: 0.5, timestamp: Date.now(), tags: [] },
        { id: '2', sentence: 'Second', importance: 0.6, timestamp: Date.now(), tags: [] },
        { id: '3', sentence: 'Third', importance: 0.7, timestamp: Date.now(), tags: [] }
      ];

      for (const item of memoryItems) {
        await memory.store(item);
      }

      const count = await memory.count();
      expect(count).toBe(3);
    });

    it('should update count after deletion', async () => {
      const memoryItem: MemoryItem = {
        id: 'count-test',
        sentence: 'Test count',
        importance: 0.5,
        timestamp: Date.now(),
        tags: []
      };

      await memory.store(memoryItem);
      expect(await memory.count()).toBe(1);

      await memory.delete('count-test');
      expect(await memory.count()).toBe(0);
    });

    it('should throw error when counting uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      await expect(uninitMemory.count()).rejects.toThrow('SQLiteMemory not initialized');
    });
  });

  describe('close functionality', () => {
    it('should close database connection', async () => {
      expect(memory.isInitialized()).toBe(true);
      await memory.close();
      expect(memory.isInitialized()).toBe(false);
    });

    it('should handle closing already closed database', async () => {
      await memory.close();
      await memory.close(); // Should not throw
      expect(memory.isInitialized()).toBe(false);
    });
  });

  describe('vacuum functionality', () => {
    it('should vacuum database successfully', async () => {
      await expect(memory.vacuum()).resolves.not.toThrow();
    });

    it('should throw error when vacuuming uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      await expect(uninitMemory.vacuum()).rejects.toThrow('SQLiteMemory not initialized');
    });
  });

  describe('getStats functionality', () => {
    it('should return stats for empty database', async () => {
      const stats = await memory.getStats();
      expect(stats.totalMemories).toBe(0);
      expect(stats.databaseSize).toBe(0);
      expect(stats.oldestMemory).toBeUndefined();
      expect(stats.newestMemory).toBeUndefined();
    });

    it('should return stats with memories', async () => {
      const oldMemory: MemoryItem = {
        id: 'old',
        sentence: 'Old memory',
        importance: 0.5,
        timestamp: 1000,
        tags: ['old']
      };

      const newMemory: MemoryItem = {
        id: 'new',
        sentence: 'New memory',
        importance: 0.8,
        timestamp: 3000,
        tags: ['new']
      };

      await memory.store(oldMemory);
      await memory.store(newMemory);

      const stats = await memory.getStats();
      expect(stats.totalMemories).toBe(2);
      expect(stats.oldestMemory?.id).toBe('old');
      expect(stats.newestMemory?.id).toBe('new');
    });

    it('should throw error when getting stats from uninitialized database', async () => {
      const uninitMemory = new SQLiteMemory(':memory:');
      await expect(uninitMemory.getStats()).rejects.toThrow('SQLiteMemory not initialized');
    });
  });

  describe('error handling', () => {
    it('should handle database constraint violations', async () => {
      // Store a memory first
      const memoryItem: MemoryItem = {
        id: 'test-id',
        sentence: 'Test sentence',
        importance: 0.5,
        timestamp: Date.now(),
        tags: ['test']
      };
      
      await memory.store(memoryItem);
      
      // Try to store a memory with the same ID (should violate primary key constraint)
      const duplicateMemory: MemoryItem = {
        id: 'test-id', // Same ID
        sentence: 'Different sentence',
        importance: 0.7,
        timestamp: Date.now(),
        tags: ['duplicate']
      };

      // This should throw because of primary key constraint violation
      await expect(memory.store(duplicateMemory)).rejects.toThrow();
    });
  });
});
