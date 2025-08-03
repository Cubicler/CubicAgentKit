import { JSONValue, JSONObject } from '../model/types.js';
import { AgentMemoryRepository } from './agent-memory-repository.js';
import { MemoryInput, MemoryQuery } from './memory-types.js';

/**
 * MCP tools for memory operations
 * These tools can be called by agents through the MCP protocol
 */
export class MemoryMCPTools {
  constructor(private readonly memoryManager: AgentMemoryRepository) {}

  /**
   * Get all available memory tools
   */
  getTools(): Record<string, (parameters: JSONObject) => Promise<JSONValue>> {
    return {
      memory_store: this.memoryStore.bind(this),
      memory_recall: this.memoryRecall.bind(this),
      memory_search: this.memorySearch.bind(this),
      memory_list: this.memoryList.bind(this),
      memory_update: this.memoryUpdate.bind(this),
      memory_delete: this.memoryDelete.bind(this),
      memory_stats: this.memoryStats.bind(this),
      memory_short_term: this.memoryShortTerm.bind(this),
      memory_clear_short_term: this.memoryClearShortTerm.bind(this)
    };
  }

  /**
   * Store new memory
   * Parameters: { body: any, score?: number, tags?: string[] }
   */
  private async memoryStore(parameters: JSONObject): Promise<JSONValue> {
    try {
      const { body, score, tags } = parameters;
      
      if (body === undefined) {
        return { error: 'Memory body is required' };
      }

      const input: MemoryInput = {
        body,
        score: typeof score === 'number' ? score : undefined,
        tags: Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string') : undefined
      };

      const memory = await this.memoryManager.remember(input);
      
      return {
        success: true,
        memory: {
          id: memory.id,
          timestamp: memory.timestamp,
          score: memory.score,
          tags: memory.tags,
          body: memory.body
        }
      };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to store memory' 
      };
    }
  }

  /**
   * Recall specific memory by ID
   * Parameters: { id: string }
   */
  private async memoryRecall(parameters: JSONObject): Promise<JSONValue> {
    try {
      const { id } = parameters;
      
      if (typeof id !== 'string') {
        return { error: 'Memory ID must be a string' };
      }

      const memory = await this.memoryManager.recall(id);
      
      if (!memory) {
        return { found: false };
      }

      return {
        found: true,
        memory: {
          id: memory.id,
          timestamp: memory.timestamp,
          score: memory.score,
          tags: memory.tags,
          body: memory.body
        }
      };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to recall memory' 
      };
    }
  }

  /**
   * Search memories
   * Parameters: { query: MemoryQuery }
   */
  private async memorySearch(parameters: JSONObject): Promise<JSONValue> {
    try {
      const query: MemoryQuery = {
        id: typeof parameters.id === 'string' ? parameters.id : undefined,
        tags: Array.isArray(parameters.tags) ? parameters.tags.filter(tag => typeof tag === 'string') : undefined,
        tagsRegex: typeof parameters.tagsRegex === 'string' ? parameters.tagsRegex : undefined,
        bodyRegex: typeof parameters.bodyRegex === 'string' ? parameters.bodyRegex : undefined,
        scoreMin: typeof parameters.scoreMin === 'number' ? parameters.scoreMin : undefined,
        scoreMax: typeof parameters.scoreMax === 'number' ? parameters.scoreMax : undefined,
        timestampAfter: typeof parameters.timestampAfter === 'number' ? parameters.timestampAfter : undefined,
        timestampBefore: typeof parameters.timestampBefore === 'number' ? parameters.timestampBefore : undefined,
        limit: typeof parameters.limit === 'number' ? parameters.limit : undefined,
        sortBy: ['score', 'timestamp', 'both'].includes(parameters.sortBy as string) ? parameters.sortBy as any : undefined,
        sortOrder: ['asc', 'desc'].includes(parameters.sortOrder as string) ? parameters.sortOrder as any : undefined
      };

      const memories = await this.memoryManager.search(query);
      
      return {
        count: memories.length,
        memories: memories.map(memory => ({
          id: memory.id,
          timestamp: memory.timestamp,
          score: memory.score,
          tags: memory.tags,
          body: memory.body
        }))
      };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to search memories' 
      };
    }
  }

  /**
   * List recent memories
   * Parameters: { limit?: number, sortBy?: string, sortOrder?: string }
   */
  private async memoryList(parameters: JSONObject): Promise<JSONValue> {
    try {
      const limit = typeof parameters.limit === 'number' ? parameters.limit : 10;
      const sortBy = ['score', 'timestamp', 'both'].includes(parameters.sortBy as string) ? parameters.sortBy as any : 'timestamp';
      const sortOrder = ['asc', 'desc'].includes(parameters.sortOrder as string) ? parameters.sortOrder as any : 'desc';

      const query: MemoryQuery = { limit, sortBy, sortOrder };
      const memories = await this.memoryManager.search(query);
      
      return {
        count: memories.length,
        memories: memories.map(memory => ({
          id: memory.id,
          timestamp: memory.timestamp,
          score: memory.score,
          tags: memory.tags,
          body: memory.body
        }))
      };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to list memories' 
      };
    }
  }

  /**
   * Update existing memory
   * Parameters: { id: string, updates: Partial<Memory> }
   */
  private async memoryUpdate(parameters: JSONObject): Promise<JSONValue> {
    try {
      const { id, updates } = parameters;
      
      if (typeof id !== 'string') {
        return { error: 'Memory ID must be a string' };
      }

      if (!updates || typeof updates !== 'object') {
        return { error: 'Updates object is required' };
      }

      const updateObj = updates as any;
      const validUpdates: any = {};

      // Validate and filter updates
      if (typeof updateObj.score === 'number') validUpdates.score = updateObj.score;
      if (Array.isArray(updateObj.tags)) validUpdates.tags = updateObj.tags;
      if (updateObj.body !== undefined) validUpdates.body = updateObj.body;
      if (typeof updateObj.timestamp === 'number') validUpdates.timestamp = updateObj.timestamp;

      const updated = await this.memoryManager.update(id, validUpdates);
      
      if (!updated) {
        return { found: false };
      }

      return {
        success: true,
        memory: {
          id: updated.id,
          timestamp: updated.timestamp,
          score: updated.score,
          tags: updated.tags,
          body: updated.body
        }
      };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to update memory' 
      };
    }
  }

  /**
   * Delete memory
   * Parameters: { id: string }
   */
  private async memoryDelete(parameters: JSONObject): Promise<JSONValue> {
    try {
      const { id } = parameters;
      
      if (typeof id !== 'string') {
        return { error: 'Memory ID must be a string' };
      }

      const deleted = await this.memoryManager.delete(id);
      
      return { deleted };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete memory' 
      };
    }
  }

  /**
   * Get memory statistics
   * Parameters: {}
   */
  private async memoryStats(parameters: JSONObject): Promise<JSONValue> {
    try {
      const stats = await this.memoryManager.getStats();
      return stats as unknown as JSONValue;
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to get memory stats' 
      };
    }
  }

  /**
   * Get all short-term memories (for prompt inclusion)
   * Parameters: {}
   */
  private async memoryShortTerm(parameters: JSONObject): Promise<JSONValue> {
    try {
      const memories = this.memoryManager.getShortTermMemories();
      
      return {
        count: memories.length,
        memories: memories.map(memory => ({
          id: memory.id,
          timestamp: memory.timestamp,
          score: memory.score,
          tags: memory.tags,
          body: memory.body
        }))
      };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to get short-term memories' 
      };
    }
  }

  /**
   * Clear all short-term memory
   * Parameters: {}
   */
  private async memoryClearShortTerm(parameters: JSONObject): Promise<JSONValue> {
    try {
      this.memoryManager.clearShortTerm();
      return { success: true };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to clear short-term memory' 
      };
    }
  }
}