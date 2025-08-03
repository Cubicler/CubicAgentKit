import { describe, it, expect } from 'vitest';
import { 
  countWords, 
  generateMemoryId, 
  createSortComparator, 
  matchesQuery, 
  validateMemoryInput,
  createDefaultMemoryConfig
} from '../../src/memory/memory-utils.js';
import { Memory, MemoryQuery } from '../../src/memory/memory-types.js';

describe('Memory Utils', () => {
  describe('countWords', () => {
    it('should count words in string', () => {
      expect(countWords('hello world')).toBe(2);
      expect(countWords('a b c d e')).toBe(5);
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });

    it('should count words in JSON objects', () => {
      // Test actual behavior for different JSON structures
      const obj = { message: 'hello world', count: 42 };
      const arr = ['hello', 'world'];
      
      // Should count words after JSON stringification
      expect(countWords(obj)).toBeGreaterThan(0);
      expect(countWords(arr)).toBeGreaterThan(0);
      expect(countWords(null)).toBe(0);
    });

    it('should handle complex nested objects', () => {
      const obj = {
        user: 'john doe',
        data: {
          items: ['item one', 'item two'],
          count: 42
        }
      };
      const wordCount = countWords(obj);
      expect(wordCount).toBeGreaterThan(0);
    });
  });

  describe('generateMemoryId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateMemoryId();
      const id2 = generateMemoryId();
      
      expect(id1).toMatch(/^mem_/);
      expect(id2).toMatch(/^mem_/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = generateMemoryId();
      expect(id).toMatch(/^mem_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('createSortComparator', () => {
    const memory1: Memory = { id: '1', timestamp: 100, score: 0.5, tags: [], body: 'test1' };
    const memory2: Memory = { id: '2', timestamp: 200, score: 0.8, tags: [], body: 'test2' };
    const memory3: Memory = { id: '3', timestamp: 150, score: 0.8, tags: [], body: 'test3' };

    it('should sort by score descending', () => {
      const comparator = createSortComparator('score', 'desc');
      const sorted = [memory1, memory2, memory3].sort(comparator);
      expect(sorted.map(m => m.id)).toEqual(['2', '3', '1']);
    });

    it('should sort by timestamp ascending', () => {
      const comparator = createSortComparator('timestamp', 'asc');
      const sorted = [memory1, memory2, memory3].sort(comparator);
      expect(sorted.map(m => m.id)).toEqual(['1', '3', '2']);
    });

    it('should sort by both score and timestamp', () => {
      const comparator = createSortComparator('both', 'desc');
      const sorted = [memory1, memory2, memory3].sort(comparator);
      // Should sort by score first, then timestamp for ties
      expect(sorted.map(m => m.id)).toEqual(['2', '3', '1']);
    });
  });

  describe('matchesQuery', () => {
    const memory: Memory = {
      id: 'test-id',
      timestamp: 1000,
      score: 0.7,
      tags: ['important', 'work', 'project-alpha'],
      body: { message: 'This is a test message', type: 'note' }
    };

    it('should match by ID', () => {
      expect(matchesQuery(memory, { id: 'test-id' })).toBe(true);
      expect(matchesQuery(memory, { id: 'other-id' })).toBe(false);
    });

    it('should match by score range', () => {
      expect(matchesQuery(memory, { scoreMin: 0.5 })).toBe(true);
      expect(matchesQuery(memory, { scoreMax: 0.8 })).toBe(true);
      expect(matchesQuery(memory, { scoreMin: 0.8 })).toBe(false);
      expect(matchesQuery(memory, { scoreMax: 0.5 })).toBe(false);
    });

    it('should match by timestamp range', () => {
      expect(matchesQuery(memory, { timestampAfter: 500 })).toBe(true);
      expect(matchesQuery(memory, { timestampBefore: 1500 })).toBe(true);
      expect(matchesQuery(memory, { timestampAfter: 1500 })).toBe(false);
      expect(matchesQuery(memory, { timestampBefore: 500 })).toBe(false);
    });

    it('should match by tags', () => {
      expect(matchesQuery(memory, { tags: ['important'] })).toBe(true);
      expect(matchesQuery(memory, { tags: ['important', 'work'] })).toBe(true);
      expect(matchesQuery(memory, { tags: ['missing'] })).toBe(false);
      expect(matchesQuery(memory, { tags: ['important', 'missing'] })).toBe(false);
    });

    it('should match by tags regex', () => {
      expect(matchesQuery(memory, { tagsRegex: 'project.*' })).toBe(true);
      expect(matchesQuery(memory, { tagsRegex: 'work' })).toBe(true);
      expect(matchesQuery(memory, { tagsRegex: 'missing' })).toBe(false);
    });

    it('should match by body regex', () => {
      expect(matchesQuery(memory, { bodyRegex: 'test.*message' })).toBe(true);
      expect(matchesQuery(memory, { bodyRegex: 'note' })).toBe(true);
      expect(matchesQuery(memory, { bodyRegex: 'missing' })).toBe(false);
    });
  });

  describe('validateMemoryInput', () => {
    it('should validate correct input', () => {
      const errors = validateMemoryInput({
        body: 'test message',
        score: 0.5,
        tags: ['test']
      });
      expect(errors).toHaveLength(0);
    });

    it('should require body', () => {
      const errors = validateMemoryInput({
        body: undefined as any
      });
      expect(errors).toContain('Memory body is required');
    });

    it('should validate score range', () => {
      const errors1 = validateMemoryInput({ body: 'test', score: -0.1 });
      const errors2 = validateMemoryInput({ body: 'test', score: 1.1 });
      
      expect(errors1).toContain('Memory score must be a number between 0 and 1');
      expect(errors2).toContain('Memory score must be a number between 0 and 1');
    });

    it('should validate tags format', () => {
      const errors1 = validateMemoryInput({ body: 'test', tags: 'not-array' as any });
      const errors2 = validateMemoryInput({ body: 'test', tags: ['valid', 123] as any });
      
      expect(errors1).toContain('Memory tags must be an array of strings');
      expect(errors2).toContain('All memory tags must be strings');
    });
  });

  describe('createDefaultMemoryConfig', () => {
    it('should create default config', () => {
      const config = createDefaultMemoryConfig();
      expect(config.shortTermMaxWords).toBe(2000);
      expect(config.defaultScore).toBe(0.5);
    });
  });
});