import { AgentMemory, MemorySearchOptions } from '../interface/memory-repository.js';

/**
 * Count words in a sentence (1 token = 1 word)
 */
export function countWords(sentence: string): number {
  if (!sentence || sentence.trim().length === 0) {
    return 0;
  }
  
  // Split by whitespace and filter out empty strings
  const words = sentence.trim().split(/\s+/).filter(word => word.length > 0);
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
 * Validate memory input for sentence-based memories
 */
export function validateMemoryInput(sentence: string, importance: number | undefined, tags: string[]): string[] {
  const errors: string[] = [];

  // Validate sentence
  if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
    errors.push('Memory sentence is required and cannot be empty');
  }

  // Validate importance
  if (importance !== undefined) {
    if (typeof importance !== 'number' || importance < 0 || importance > 1) {
      errors.push('Memory importance must be a number between 0 and 1');
    }
  }

  // Validate tags (mandatory and non-empty)
  if (!Array.isArray(tags)) {
    errors.push('Memory tags must be an array of strings');
  } else if (tags.length === 0) {
    errors.push('Memory tags cannot be empty - at least one tag is required');
  } else {
    const invalidTags = tags.filter(tag => !tag || typeof tag !== 'string' || tag.trim().length === 0);
    if (invalidTags.length > 0) {
      errors.push('All memory tags must be non-empty strings');
    }
  }

  return errors;
}

/**
 * Validate tags array (for editing operations)
 */
export function validateTags(tags: string[]): string[] {
  const errors: string[] = [];

  if (!Array.isArray(tags)) {
    errors.push('Tags must be an array of strings');
  } else if (tags.length === 0) {
    errors.push('Tags cannot be empty - at least one tag is required');
  } else {
    const invalidTags = tags.filter(tag => !tag || typeof tag !== 'string' || tag.trim().length === 0);
    if (invalidTags.length > 0) {
      errors.push('All tags must be non-empty strings');
    }
  }

  return errors;
}

/**
 * Create sort comparator for memories
 */
export function createSortComparator(
  sortBy: 'importance' | 'timestamp' | 'both' = 'both',
  sortOrder: 'asc' | 'desc' = 'desc'
): (a: AgentMemory, b: AgentMemory) => number {
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  switch (sortBy) {
    case 'importance':
      return (a: AgentMemory, b: AgentMemory) => multiplier * (a.importance - b.importance);
    
    case 'timestamp':
      return (a: AgentMemory, b: AgentMemory) => multiplier * (getMemoryTimestamp(a) - getMemoryTimestamp(b));
    
    case 'both':
      return (a: AgentMemory, b: AgentMemory) => {
        // Primary sort by importance, secondary by timestamp
        const importanceDiff = a.importance - b.importance;
        if (Math.abs(importanceDiff) > 0.001) { // Avoid floating point equality issues
          return multiplier * importanceDiff;
        }
        return multiplier * (getMemoryTimestamp(a) - getMemoryTimestamp(b));
      };
    
    default:
      return (a: AgentMemory, b: AgentMemory) => multiplier * (getMemoryTimestamp(b) - getMemoryTimestamp(a)); // Default: newest first
  }
}

/**
 * Extract timestamp from memory ID (for sorting when no explicit timestamp)
 */
function getMemoryTimestamp(memory: AgentMemory): number {
  // Extract timestamp from ID format: mem_{timestamp}_{random}
  const idParts = memory.id.split('_');
  if (idParts.length >= 2 && idParts[1]) {
    const timestampBase36 = idParts[1];
    const timestamp = parseInt(timestampBase36, 36);
    if (!isNaN(timestamp)) {
      return timestamp;
    }
  }
  // Fallback to current time if can't extract
  return Date.now();
}

/**
 * Check if memory matches search criteria
 */
export function matchesSearchCriteria(memory: AgentMemory, options: MemorySearchOptions): boolean {
  // Content exact match
  if (options.content && !memory.sentence.includes(options.content)) {
    return false;
  }

  // Content regex match
  if (options.contentRegex) {
    try {
      const contentRegex = new RegExp(options.contentRegex, 'i');
      if (!contentRegex.test(memory.sentence)) {
        return false;
      }
    } catch {
      throw new Error(`Invalid content regex pattern: ${options.contentRegex}`);
    }
  }

  // Tags exact match (must contain all specified tags)
  if (options.tags && options.tags.length > 0) {
    const hasAllTags = options.tags.every(tag => memory.tags.includes(tag));
    if (!hasAllTags) {
      return false;
    }
  }

  // Tags regex match
  if (options.tagsRegex) {
    try {
      const tagsRegex = new RegExp(options.tagsRegex, 'i');
      const hasMatchingTag = memory.tags.some(tag => tagsRegex.test(tag));
      if (!hasMatchingTag) {
        return false;
      }
    } catch {
      throw new Error(`Invalid tags regex pattern: ${options.tagsRegex}`);
    }
  }

  return true;
}

/**
 * Create default memory configuration
 */
export function createDefaultMemoryConfig(): { shortTermMaxTokens: number; defaultImportance: number } {
  return {
    shortTermMaxTokens: 2000,  // Token-based capacity (1 token = 1 word)
    defaultImportance: 0.5
  };
}
