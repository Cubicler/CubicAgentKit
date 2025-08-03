import { JSONValue } from '../model/types.js';
import { Memory, MemoryQuery, MemorySortComparator } from './memory-types.js';

/**
 * Count words in a JSON value by converting to string and counting
 */
export function countWords(value: JSONValue): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);
  
  // Split by whitespace and filter out empty strings
  const words = text.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Generate a unique ID for memory
 */
export function generateMemoryId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `mem_${timestamp}_${randomPart}`;
}

/**
 * Create sort comparator based on query parameters
 */
export function createSortComparator(sortBy: 'score' | 'timestamp' | 'both', sortOrder: 'asc' | 'desc' = 'desc'): MemorySortComparator {
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  switch (sortBy) {
    case 'score':
      return (a: Memory, b: Memory) => multiplier * (a.score - b.score);
    
    case 'timestamp':
      return (a: Memory, b: Memory) => multiplier * (a.timestamp - b.timestamp);
    
    case 'both':
      return (a: Memory, b: Memory) => {
        // Primary sort by score, secondary by timestamp
        const scoreDiff = a.score - b.score;
        if (Math.abs(scoreDiff) > 0.001) { // Avoid floating point equality issues
          return multiplier * scoreDiff;
        }
        return multiplier * (a.timestamp - b.timestamp);
      };
    
    default:
      return (a: Memory, b: Memory) => multiplier * (b.timestamp - a.timestamp); // Default: newest first
  }
}

/**
 * Check if memory matches the query criteria
 */
export function matchesQuery(memory: Memory, query: MemoryQuery): boolean {
  // ID exact match
  if (query.id && memory.id !== query.id) {
    return false;
  }

  // Score range
  if (query.scoreMin !== undefined && memory.score < query.scoreMin) {
    return false;
  }
  if (query.scoreMax !== undefined && memory.score > query.scoreMax) {
    return false;
  }

  // Timestamp range
  if (query.timestampAfter !== undefined && memory.timestamp <= query.timestampAfter) {
    return false;
  }
  if (query.timestampBefore !== undefined && memory.timestamp >= query.timestampBefore) {
    return false;
  }

  // Tags exact match (must contain all specified tags)
  if (query.tags && query.tags.length > 0) {
    const hasAllTags = query.tags.every(tag => memory.tags.includes(tag));
    if (!hasAllTags) {
      return false;
    }
  }

  // Tags regex match
  if (query.tagsRegex) {
    const tagsRegex = new RegExp(query.tagsRegex, 'i');
    const hasMatchingTag = memory.tags.some(tag => tagsRegex.test(tag));
    if (!hasMatchingTag) {
      return false;
    }
  }

  // Body regex match
  if (query.bodyRegex) {
    const bodyRegex = new RegExp(query.bodyRegex, 'i');
    const bodyText = typeof memory.body === 'string' ? memory.body : JSON.stringify(memory.body);
    if (!bodyRegex.test(bodyText)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate memory input
 */
export function validateMemoryInput(input: { score?: number; tags?: string[]; body: JSONValue }): string[] {
  const errors: string[] = [];

  if (input.body === undefined) {
    errors.push('Memory body is required');
  }

  if (input.score !== undefined) {
    if (typeof input.score !== 'number' || input.score < 0 || input.score > 1) {
      errors.push('Memory score must be a number between 0 and 1');
    }
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      errors.push('Memory tags must be an array of strings');
    } else {
      const invalidTags = input.tags.filter(tag => typeof tag !== 'string');
      if (invalidTags.length > 0) {
        errors.push('All memory tags must be strings');
      }
    }
  }

  return errors;
}

/**
 * Create default memory configuration
 */
export function createDefaultMemoryConfig(): { shortTermMaxWords: number; defaultScore: number } {
  return {
    shortTermMaxWords: 2000,  // Reasonable default for ~8k token context
    defaultScore: 0.5
  };
}