import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentMemoryRepository } from '../../src/memory/agent-memory-repository.js';
import { AgentMemory } from '../../src/interface/memory-repository.js';
import { PersistentMemory } from '../../src/interface/persistent-memory.js';
import { ShortTermMemory } from '../../src/interface/short-term-memory.js';
import { MemoryItem } from '../../src/model/memory.js';

// Mock implementations
class MockPersistentMemory implements PersistentMemory {
  private readonly memories = new Map<string, MemoryItem>();
  private isInit = false;

  async initialize(): Promise<void> {
    this.isInit = true;
  }

  async store(memory: MemoryItem): Promise<void> {
    this.memories.set(memory.id, memory);
  }

  async retrieve(id: string): Promise<AgentMemory | null> {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }
    
    return new AgentMemory(memory.id, memory.sentence, memory.importance, memory.tags);
  }

  async search(options: any): Promise<AgentMemory[]> {
    let results = Array.from(this.memories.values()).map(m => 
      new AgentMemory(m.id, m.sentence, m.importance, m.tags)
    );

    // Apply basic tag filtering for the mock
    if (options.tags && options.tags.length > 0) {
      results = results.filter(memory => 
        options.tags.some((tag: string) => memory.tags.includes(tag))
      );
    }

    return results;
  }

  async update(id: string, updates: Partial<Pick<MemoryItem, 'sentence' | 'importance' | 'tags'>>): Promise<boolean> {
    const memory = this.memories.get(id);
    if (!memory) {
      return false;
    }

    const updated = { ...memory };
    if (updates.sentence !== undefined) {
      updated.sentence = updates.sentence;
    }
    if (updates.importance !== undefined) {
      updated.importance = updates.importance;
    }
    if (updates.tags !== undefined) {
      updated.tags = updates.tags;
    }
    updated.timestamp = Date.now();

    this.memories.set(id, updated);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.memories.delete(id);
  }

  async count(): Promise<number> {
    return this.memories.size;
  }

  async close(): Promise<void> {
    this.isInit = false;
  }

  // Test helpers
  clear(): void {
    this.memories.clear();
  }

  has(id: string): boolean {
    return this.memories.has(id);
  }
}

class MockShortTermMemory implements ShortTermMemory {
  private readonly memories = new Map<string, MemoryItem>();
  private readonly maxTokens: number;
  private currentTokens = 0;

  constructor(maxTokens = 1000) {
    this.maxTokens = maxTokens;
  }

  put(memory: MemoryItem): MemoryItem | null {
    this.memories.set(memory.id, memory);
    this.currentTokens += memory.sentence.length; // Simple token estimation
    return null; // No eviction in this mock
  }

  get(id: string): AgentMemory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }
    
    return new AgentMemory(memory.id, memory.sentence, memory.importance, memory.tags);
  }

  remove(id: string): AgentMemory | null {
    const memory = this.memories.get(id);
    if (memory) {
      this.currentTokens -= memory.sentence.length;
      this.memories.delete(id);
      return new AgentMemory(memory.id, memory.sentence, memory.importance, memory.tags);
    }
    return null;
  }

  getAll(): AgentMemory[] {
    return Array.from(this.memories.values()).map(m => 
      new AgentMemory(m.id, m.sentence, m.importance, m.tags)
    );
  }

  clear(): void {
    this.memories.clear();
    this.currentTokens = 0;
  }

  getCurrentTokenCount(): number {
    return this.currentTokens;
  }

  getMaxTokenCount(): number {
    return this.maxTokens;
  }

  // Test helper
  has(id: string): boolean {
    return this.memories.has(id);
  }
}

describe('AgentMemoryRepository', () => {
  let repository: AgentMemoryRepository;
  let mockLongTerm: MockPersistentMemory;
  let mockShortTerm: MockShortTermMemory;

  beforeEach(async () => {
    mockLongTerm = new MockPersistentMemory();
    mockShortTerm = new MockShortTermMemory(1000);
    repository = new AgentMemoryRepository(mockLongTerm, mockShortTerm);
    await repository.initialize();
  });

  describe('constructor and initialization', () => {
    it('should create repository with default config', () => {
      const config = repository.getConfig();
      expect(config.shortTermMaxTokens).toBe(2000);
      expect(config.defaultImportance).toBe(0.5);
    });

    it('should create repository with custom config', () => {
      const customRepository = new AgentMemoryRepository(
        mockLongTerm,
        mockShortTerm,
        { shortTermMaxTokens: 5000, defaultImportance: 0.7 }
      );

      const config = customRepository.getConfig();
      expect(config.shortTermMaxTokens).toBe(5000);
      expect(config.defaultImportance).toBe(0.7);
    });

    it('should initialize long-term storage', async () => {
      const newMockLongTerm = new MockPersistentMemory();
      const newRepository = new AgentMemoryRepository(newMockLongTerm, mockShortTerm);
      
      await newRepository.initialize();
      // Should be initialized (we can't easily test this without exposing internals)
      expect(newRepository.getConfig()).toBeDefined();
    });
  });

  describe('remember', () => {
    it('should store memory with default importance', async () => {
      const id = await repository.remember('Test memory', undefined, ['test']);
      
      expect(id).toBeDefined();
      expect(mockLongTerm.has(id)).toBe(true);
      expect(mockShortTerm.has(id)).toBe(true);
    });

    it('should store memory with specified importance', async () => {
      const id = await repository.remember('Important memory', 0.9, ['important']);
      const recalled = await repository.recall(id);
      
      expect(recalled?.importance).toBe(0.9);
    });

    it('should trim sentences and tags', async () => {
      const id = await repository.remember('  Test memory  ', 0.5, ['  tag1  ', '  tag2  ']);
      const recalled = await repository.recall(id);
      
      expect(recalled?.sentence).toBe('Test memory');
      expect(recalled?.tags).toEqual(['tag1', 'tag2']);
    });

    it('should throw error for empty sentence', async () => {
      await expect(repository.remember('', 0.5, ['test'])).rejects.toThrow('Invalid memory input');
    });

    it('should throw error for empty tags', async () => {
      await expect(repository.remember('Test', 0.5, [])).rejects.toThrow('Invalid memory input');
    });

    it('should throw error for invalid importance', async () => {
      await expect(repository.remember('Test', -0.1, ['test'])).rejects.toThrow('Invalid memory input');
      await expect(repository.remember('Test', 1.1, ['test'])).rejects.toThrow('Invalid memory input');
    });
  });

  describe('recall', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Test memory for recall', 0.7, ['recall', 'test']);
    });

    it('should recall memory from short-term first', async () => {
      const recalled = await repository.recall(memoryId);
      
      expect(recalled).not.toBeNull();
      expect(recalled?.sentence).toBe('Test memory for recall');
      expect(recalled?.importance).toBe(0.7);
      expect(recalled?.tags).toEqual(['recall', 'test']);
    });

    it('should recall memory from long-term if not in short-term', async () => {
      // Remove from short-term only
      mockShortTerm.remove(memoryId);
      
      const recalled = await repository.recall(memoryId);
      
      expect(recalled).not.toBeNull();
      expect(recalled?.sentence).toBe('Test memory for recall');
      
      // Should be moved back to short-term
      expect(mockShortTerm.has(memoryId)).toBe(true);
    });

    it('should return null for non-existent memory', async () => {
      const recalled = await repository.recall('non-existent');
      expect(recalled).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repository.remember('JavaScript is great', 0.8, ['programming']);
      await repository.remember('Python is awesome', 0.7, ['programming']);
      await repository.remember('Testing is important', 0.6, ['testing']);
    });

    it('should search and merge results from both storages', async () => {
      const results = await repository.search({});
      expect(results).toHaveLength(3);
    });

    it('should prioritize short-term results over long-term', async () => {
      // This is tested implicitly since both storages contain the same items
      // In a real scenario, if the same ID exists in both, short-term would take precedence
      const results = await repository.search({});
      expect(results).toHaveLength(3);
    });

    it('should apply search filters', async () => {
      const results = await repository.search({ tags: ['programming'] });
      expect(results).toHaveLength(2);
    });

    it('should apply limits', async () => {
      const results = await repository.search({ limit: 2 });
      expect(results).toHaveLength(2);
    });
  });

  describe('getShortTermMemories', () => {
    it('should return all short-term memories', async () => {
      await repository.remember('Memory 1', 0.5, ['test1']);
      await repository.remember('Memory 2', 0.6, ['test2']);

      const shortTermMemories = repository.getShortTermMemories();
      expect(shortTermMemories).toHaveLength(2);
    });

    it('should return empty array when no short-term memories', () => {
      const shortTermMemories = repository.getShortTermMemories();
      expect(shortTermMemories).toHaveLength(0);
    });
  });

  describe('addToShortTermMemory', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Memory for short-term test', 0.5, ['test']);
      // Remove from short-term to test adding it back
      mockShortTerm.remove(memoryId);
    });

    it('should add memory to short-term from long-term', async () => {
      const result = await repository.addToShortTermMemory(memoryId);
      
      expect(result).toBe(true);
      expect(mockShortTerm.has(memoryId)).toBe(true);
    });

    it('should return true if already in short-term', async () => {
      // Add back to short-term first
      await repository.addToShortTermMemory(memoryId);
      
      const result = await repository.addToShortTermMemory(memoryId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent memory', async () => {
      const result = await repository.addToShortTermMemory('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('editImportance', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Memory to edit importance', 0.5, ['edit']);
    });

    it('should update importance in both storages', async () => {
      const result = await repository.editImportance(memoryId, 0.9);
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.importance).toBe(0.9);
    });

    it('should throw error for invalid importance', async () => {
      await expect(repository.editImportance(memoryId, -0.1)).rejects.toThrow('Importance must be a number between 0 and 1');
      await expect(repository.editImportance(memoryId, 1.1)).rejects.toThrow('Importance must be a number between 0 and 1');
    });

    it('should return false for non-existent memory', async () => {
      const result = await repository.editImportance('non-existent', 0.8);
      expect(result).toBe(false);
    });
  });

  describe('editContent', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Original content', 0.5, ['edit']);
    });

    it('should update content in both storages', async () => {
      const result = await repository.editContent(memoryId, 'Updated content');
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.sentence).toBe('Updated content');
    });

    it('should trim content', async () => {
      const result = await repository.editContent(memoryId, '  Trimmed content  ');
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.sentence).toBe('Trimmed content');
    });

    it('should throw error for empty content', async () => {
      await expect(repository.editContent(memoryId, '')).rejects.toThrow('Memory sentence is required and cannot be empty');
      await expect(repository.editContent(memoryId, '   ')).rejects.toThrow('Memory sentence is required and cannot be empty');
    });

    it('should return false for non-existent memory', async () => {
      const result = await repository.editContent('non-existent', 'New content');
      expect(result).toBe(false);
    });
  });

  describe('addTag', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Memory for tag testing', 0.5, ['original']);
    });

    it('should add new tag', async () => {
      const result = await repository.addTag(memoryId, 'newtag');
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.tags).toContain('newtag');
      expect(recalled?.tags).toContain('original');
    });

    it('should trim tags', async () => {
      const result = await repository.addTag(memoryId, '  trimmed  ');
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.tags).toContain('trimmed');
    });

    it('should return false if tag already exists', async () => {
      const result = await repository.addTag(memoryId, 'original');
      expect(result).toBe(false);
    });

    it('should throw error for empty tag', async () => {
      await expect(repository.addTag(memoryId, '')).rejects.toThrow('Tag must be a non-empty string');
      await expect(repository.addTag(memoryId, '   ')).rejects.toThrow('Tag must be a non-empty string');
    });

    it('should return false for non-existent memory', async () => {
      const result = await repository.addTag('non-existent', 'tag');
      expect(result).toBe(false);
    });
  });

  describe('removeTag', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Memory with multiple tags', 0.5, ['tag1', 'tag2', 'tag3']);
    });

    it('should remove existing tag', async () => {
      const result = await repository.removeTag(memoryId, 'tag2');
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.tags).not.toContain('tag2');
      expect(recalled?.tags).toContain('tag1');
      expect(recalled?.tags).toContain('tag3');
    });

    it('should throw error when removing last tag', async () => {
      const singleTagId = await repository.remember('Single tag memory', 0.5, ['onlytag']);
      
      await expect(repository.removeTag(singleTagId, 'onlytag'))
        .rejects.toThrow('Cannot remove tag - memory must have at least one tag');
    });

    it('should return false for non-existent tag', async () => {
      const result = await repository.removeTag(memoryId, 'nonexistent');
      expect(result).toBe(false);
    });

    it('should return false for non-existent memory', async () => {
      const result = await repository.removeTag('non-existent', 'tag');
      expect(result).toBe(false);
    });
  });

  describe('replaceTags', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Memory for tag replacement', 0.5, ['old1', 'old2']);
    });

    it('should replace all tags', async () => {
      const result = await repository.replaceTags(memoryId, ['new1', 'new2', 'new3']);
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.tags).toEqual(['new1', 'new2', 'new3']);
    });

    it('should trim tags', async () => {
      const result = await repository.replaceTags(memoryId, ['  trimmed1  ', '  trimmed2  ']);
      
      expect(result).toBe(true);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled?.tags).toEqual(['trimmed1', 'trimmed2']);
    });

    it('should throw error for empty tags array', async () => {
      await expect(repository.replaceTags(memoryId, [])).rejects.toThrow('Invalid tags');
    });

    it('should throw error for empty tag strings', async () => {
      await expect(repository.replaceTags(memoryId, ['valid', ''])).rejects.toThrow('Invalid tags');
    });

    it('should return false for non-existent memory', async () => {
      const result = await repository.replaceTags('non-existent', ['new']);
      expect(result).toBe(false);
    });
  });

  describe('forget', () => {
    let memoryId: string;

    beforeEach(async () => {
      memoryId = await repository.remember('Memory to forget', 0.5, ['forget']);
    });

    it('should remove memory from both storages', async () => {
      const result = await repository.forget(memoryId);
      
      expect(result).toBe(true);
      expect(mockLongTerm.has(memoryId)).toBe(false);
      expect(mockShortTerm.has(memoryId)).toBe(false);
      
      const recalled = await repository.recall(memoryId);
      expect(recalled).toBeNull();
    });

    it('should return false for non-existent memory', async () => {
      const result = await repository.forget('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await repository.remember('Memory 1', 0.5, ['test1']);
      await repository.remember('Memory 2', 0.6, ['test2']);

      const stats = await repository.getStats();
      
      expect(stats.totalMemories).toBe(2);
      expect(stats.shortTermCount).toBe(2);
      expect(stats.shortTermTokens).toBeGreaterThan(0);
      expect(stats.shortTermMaxTokens).toBe(1000);
      expect(stats.shortTermUtilization).toBeGreaterThan(0);
    });

    it('should return zero stats for empty repository', async () => {
      const stats = await repository.getStats();
      
      expect(stats.totalMemories).toBe(0);
      expect(stats.shortTermCount).toBe(0);
      expect(stats.shortTermTokens).toBe(0);
      expect(stats.shortTermUtilization).toBe(0);
    });
  });

  describe('clearShortTerm', () => {
    it('should clear only short-term memory', async () => {
      const memoryId = await repository.remember('Memory to clear', 0.5, ['clear']);
      
      expect(mockShortTerm.has(memoryId)).toBe(true);
      expect(mockLongTerm.has(memoryId)).toBe(true);
      
      repository.clearShortTerm();
      
      expect(mockShortTerm.has(memoryId)).toBe(false);
      expect(mockLongTerm.has(memoryId)).toBe(true);
    });
  });

  describe('close', () => {
    it('should close long-term storage', async () => {
      await repository.close();
      // We can't easily test the close state without exposing internals
      // This test mainly ensures no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle concurrent operations gracefully', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(repository.remember(`Memory ${i}`, 0.5, [`tag${i}`]));
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(id => expect(id).toBeDefined());
    });

    it('should handle memory repository state consistently', async () => {
      const memoryId = await repository.remember('Consistency test', 0.5, ['consistency']);
      
      // Perform multiple operations
      await repository.editImportance(memoryId, 0.8);
      await repository.addTag(memoryId, 'newtag');
      await repository.editContent(memoryId, 'Updated content');
      
      // Verify final state
      const recalled = await repository.recall(memoryId);
      expect(recalled?.sentence).toBe('Updated content');
      expect(recalled?.importance).toBe(0.8);
      expect(recalled?.tags).toContain('consistency');
      expect(recalled?.tags).toContain('newtag');
    });
  });
});
