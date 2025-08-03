import { describe, it, expect, beforeEach } from 'vitest';
import { LRUShortTermMemory } from '../../src/memory/lru-short-term-memory.js';
import { Memory } from '../../src/memory/memory-types.js';

describe('LRUShortTermMemory', () => {
  let memory: LRUShortTermMemory;

  beforeEach(() => {
    memory = new LRUShortTermMemory(100); // 100 word capacity
  });

  const createMemory = (id: string, body: string, score: number = 0.5): Memory => ({
    id,
    timestamp: Date.now(),
    score,
    tags: [],
    body
  });

  describe('basic operations', () => {
    it('should store and retrieve memory', () => {
      const mem = createMemory('test1', 'hello world');
      memory.put(mem);
      
      const retrieved = memory.get('test1');
      expect(retrieved).toEqual(mem);
    });

    it('should return null for non-existent memory', () => {
      expect(memory.get('non-existent')).toBe(null);
    });

    it('should remove memory', () => {
      const mem = createMemory('test1', 'hello world');
      memory.put(mem);
      
      const removed = memory.remove('test1');
      expect(removed).toEqual(mem);
      expect(memory.get('test1')).toBe(null);
    });

    it('should clear all memories', () => {
      memory.put(createMemory('test1', 'hello'));
      memory.put(createMemory('test2', 'world'));
      
      expect(memory.getAll()).toHaveLength(2);
      
      memory.clear();
      expect(memory.getAll()).toHaveLength(0);
      expect(memory.getCurrentWordCount()).toBe(0);
    });
  });

  describe('LRU behavior', () => {
    beforeEach(() => {
      memory = new LRUShortTermMemory(10); // Small capacity for testing
    });

    it('should move accessed memory to front', () => {
      memory.put(createMemory('first', 'one'));
      memory.put(createMemory('second', 'two'));
      memory.put(createMemory('third', 'three'));
      
      // Access first memory
      memory.get('first');
      
      const all = memory.getAll();
      expect(all[0].id).toBe('first'); // Should be at front
    });

    it('should evict least recently used when over capacity', () => {
      // Each memory has ~1-2 words, capacity is 10 words
      memory.put(createMemory('mem1', 'one two three four')); // 4 words
      memory.put(createMemory('mem2', 'five six')); // 2 words
      memory.put(createMemory('mem3', 'seven eight nine ten eleven')); // 5 words - should trigger eviction
      
      // mem1 should be evicted (LRU)
      expect(memory.get('mem1')).toBe(null);
      expect(memory.get('mem2')).not.toBe(null);
      expect(memory.get('mem3')).not.toBe(null);
    });

    it('should return evicted memory when putting new memory', () => {
      memory.put(createMemory('mem1', 'one two three four')); // 4 words
      memory.put(createMemory('mem2', 'five six')); // 2 words
      
      const evicted = memory.put(createMemory('mem3', 'seven eight nine ten eleven')); // 5 words
      
      expect(evicted).not.toBe(null);
      expect(evicted?.id).toBe('mem1');
    });
  });

  describe('word counting', () => {
    it('should track word count correctly', () => {
      expect(memory.getCurrentWordCount()).toBe(0);
      
      memory.put(createMemory('test1', 'hello world')); // 2 words
      expect(memory.getCurrentWordCount()).toBe(2);
      
      memory.put(createMemory('test2', 'foo bar baz')); // 3 words
      expect(memory.getCurrentWordCount()).toBe(5);
      
      memory.remove('test1');
      expect(memory.getCurrentWordCount()).toBe(3);
    });

    it('should update word count when updating existing memory', () => {
      memory.put(createMemory('test1', 'hello')); // 1 word
      expect(memory.getCurrentWordCount()).toBe(1);
      
      memory.put(createMemory('test1', 'hello world test')); // 3 words
      expect(memory.getCurrentWordCount()).toBe(3);
    });

    it('should return correct max word count', () => {
      expect(memory.getMaxWordCount()).toBe(100);
    });
  });

  describe('getAll ordering', () => {
    it('should return memories in MRU order', () => {
      memory.put(createMemory('first', 'one'));
      memory.put(createMemory('second', 'two'));
      memory.put(createMemory('third', 'three'));
      
      // Access second to make it most recent
      memory.get('second');
      
      const all = memory.getAll();
      expect(all.map(m => m.id)).toEqual(['second', 'third', 'first']);
    });

    it('should handle empty memory', () => {
      expect(memory.getAll()).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle memory larger than capacity', () => {
      const largeMemory = new LRUShortTermMemory(5); // 5 word capacity
      
      // Try to add memory with 10 words
      largeMemory.put(createMemory('large', 'one two three four five six seven eight nine ten'));
      
      // With capacity of 5 and memory of 10 words, it should be evicted immediately
      // This is expected behavior for LRU with insufficient capacity
      expect(largeMemory.getCurrentWordCount()).toBeLessThanOrEqual(5);
    });

    it('should handle zero capacity', () => {
      const zeroMemory = new LRUShortTermMemory(0);
      
      zeroMemory.put(createMemory('test', 'hello'));
      // Should immediately evict due to zero capacity
      expect(zeroMemory.get('test')).toBe(null);
      expect(zeroMemory.getCurrentWordCount()).toBe(0);
    });

    it('should handle updating non-existent memory', () => {
      const evicted = memory.put(createMemory('test1', 'hello'));
      expect(evicted).toBe(null);
    });
  });
});