import { describe, it, expect } from 'vitest';
import { 
  countWords, 
  generateMemoryId, 
  createSortComparator, 
  matchesSearchCriteria, 
  validateMemoryInput,
  createDefaultMemoryConfig
} from '../../src/utils/memory-utils.js';
import { AgentMemory, MemorySearchOptions } from '../../src/interface/memory-repository.js';

describe('Memory Utils', () => {
  describe('countWords', () => {
    it('should count words in string', () => {
      expect(countWords('hello world')).toBe(2);
      expect(countWords('a b c d e')).toBe(5);
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });

    it('should handle empty and whitespace strings', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('\t\n  ')).toBe(0);
      expect(countWords('word')).toBe(1);
      expect(countWords('  word  ')).toBe(1);
    });

    it('should handle complex sentences', () => {
      expect(countWords('This is a test sentence')).toBe(5);
      expect(countWords('Multiple   spaces   between   words')).toBe(4);
      // "Punctuation, does not. affect! word? counting." = 6 words (punctuation is part of words)
      expect(countWords('Punctuation, does not. affect! word? counting.')).toBe(6);
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
    // Create memories with known timestamps embedded in their IDs
    const memory1: AgentMemory = new AgentMemory('mem_1000_abc', 'test1', 0.5, []);
    const memory2: AgentMemory = new AgentMemory('mem_3000_def', 'test2', 0.8, []);
    const memory3: AgentMemory = new AgentMemory('mem_2000_ghi', 'test3', 0.8, []);

    it('should sort by score descending', () => {
      const comparator = createSortComparator('importance', 'desc');
      const sorted = [memory1, memory2, memory3].sort(comparator);
      expect(sorted.map(m => m.id)).toEqual(['mem_3000_def', 'mem_2000_ghi', 'mem_1000_abc']);
    });

    it('should sort by timestamp ascending', () => {
      const comparator = createSortComparator('timestamp', 'asc');
      const sorted = [memory1, memory2, memory3].sort(comparator);
      // Should be sorted by timestamp: 1000, 2000, 3000
      expect(sorted.map(m => m.id)).toEqual(['mem_1000_abc', 'mem_2000_ghi', 'mem_3000_def']);
    });

    it('should sort by both score and timestamp', () => {
      const comparator = createSortComparator('both', 'desc');
      const sorted = [memory1, memory2, memory3].sort(comparator);
      // Should sort by score first (0.8, 0.8, 0.5), then timestamp for ties (3000, 2000)
      expect(sorted.map(m => m.id)).toEqual(['mem_3000_def', 'mem_2000_ghi', 'mem_1000_abc']);
    });
  });

  describe('matchesSearchCriteria', () => {
    const memory = new AgentMemory(
      'test-id',
      'This is a test message about work and project-alpha',
      0.7,
      ['important', 'work', 'project-alpha']
    );

    it('should match by content exact match', () => {
      expect(matchesSearchCriteria(memory, { content: 'test message' })).toBe(true);
      expect(matchesSearchCriteria(memory, { content: 'missing content' })).toBe(false);
    });

    it('should match by content regex', () => {
      expect(matchesSearchCriteria(memory, { contentRegex: 'test.*message' })).toBe(true);
      expect(matchesSearchCriteria(memory, { contentRegex: 'work' })).toBe(true);
      expect(matchesSearchCriteria(memory, { contentRegex: 'missing' })).toBe(false);
    });

    it('should match by tags exact match', () => {
      expect(matchesSearchCriteria(memory, { tags: ['important'] })).toBe(true);
      expect(matchesSearchCriteria(memory, { tags: ['important', 'work'] })).toBe(true);
      expect(matchesSearchCriteria(memory, { tags: ['missing'] })).toBe(false);
      expect(matchesSearchCriteria(memory, { tags: ['important', 'missing'] })).toBe(false);
    });

    it('should match by tags regex', () => {
      expect(matchesSearchCriteria(memory, { tagsRegex: 'project.*' })).toBe(true);
      expect(matchesSearchCriteria(memory, { tagsRegex: 'work' })).toBe(true);
      expect(matchesSearchCriteria(memory, { tagsRegex: 'missing' })).toBe(false);
    });

    it('should handle invalid regex patterns', () => {
      expect(() => matchesSearchCriteria(memory, { contentRegex: '[invalid' })).toThrow('Invalid content regex pattern');
      expect(() => matchesSearchCriteria(memory, { tagsRegex: '[invalid' })).toThrow('Invalid tags regex pattern');
    });
  });

  // Note: Commented out tests for old Memory interface

  describe('validateMemoryInput', () => {
    it('should validate correct input', () => {
      const errors = validateMemoryInput('test message', 0.5, ['test']);
      expect(errors).toHaveLength(0);
    });

    it('should require sentence', () => {
      const errors = validateMemoryInput('', undefined, ['test']);
      expect(errors).toContain('Memory sentence is required and cannot be empty');
    });

    it('should validate importance range', () => {
      const errors1 = validateMemoryInput('test', -0.1, ['test']);
      const errors2 = validateMemoryInput('test', 1.1, ['test']);
      
      expect(errors1).toContain('Memory importance must be a number between 0 and 1');
      expect(errors2).toContain('Memory importance must be a number between 0 and 1');
    });

    it('should validate tags format', () => {
      const errors1 = validateMemoryInput('test', undefined, 'not-array' as any);
      const errors2 = validateMemoryInput('test', undefined, ['valid', 123] as any);
      
      expect(errors1).toContain('Memory tags must be an array of strings');
      expect(errors2).toContain('All memory tags must be non-empty strings');
    });

    it('should require at least one tag', () => {
      const errors = validateMemoryInput('test', undefined, []);
      expect(errors).toContain('Memory tags cannot be empty - at least one tag is required');
    });
  });

  describe('createDefaultMemoryConfig', () => {
    it('should create default config', () => {
      const config = createDefaultMemoryConfig();
      expect(config.shortTermMaxTokens).toBe(2000);
      expect(config.defaultImportance).toBe(0.5);
    });
  });
});