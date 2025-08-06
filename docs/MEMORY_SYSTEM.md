# Memory System Guide

CubicAgentKit provides a sophisticated two-tier memory system combining persistent SQLite storage with LRU (Least Recently Used) short-term caching for optimal performance and persistence.

## Overview

The memory system consists of:

- **Persistent Layer**: SQLite database for long-term storage with full-text search
- **Cache Layer**: LRU cache for frequently accessed memories based on token count
- **Factory Functions**: Easy setup for common configurations

## Quick Start

### Default In-Memory Setup

```typescript
import { CubicAgent, createDefaultMemoryRepository } from '@cubicler/cubicagentkit';

const memory = await createDefaultMemoryRepository();
const agent = new CubicAgent(client, server, memory);

await agent.start(async (request, client, context) => {
  // Remember user interactions
  const memoryId = await context.memory?.remember(
    'User prefers detailed explanations',
    0.8,
    ['preference', 'communication']
  );
  
  // Search for relevant context
  const memories = await context.memory?.search({
    tags: ['preference'],
    limit: 3
  });
  
  return {
    type: 'text',
    content: `I remember ${memories?.length || 0} preferences`,
    usedToken: 25
  };
});
```

### Persistent File-Based Setup

```typescript
import { createSQLiteMemoryRepository } from '@cubicler/cubicagentkit';

// Create production memory with file-based SQLite
const memory = await createSQLiteMemoryRepository('./agent-memories.db', 2000, 0.7);
const agent = new CubicAgent(client, server, memory);
```

## Factory Functions

### createDefaultMemoryRepository

Creates an in-memory SQLite database with LRU cache:

```typescript
async function createDefaultMemoryRepository(
  maxTokens?: number,        // Default: 1500
  defaultImportance?: number // Default: 0.5
): Promise<AgentMemoryRepository>

// Examples
const memory1 = await createDefaultMemoryRepository(); // Defaults
const memory2 = await createDefaultMemoryRepository(3000, 0.8); // Custom limits
```

### createSQLiteMemoryRepository

Creates a file-based SQLite database with LRU cache:

```typescript
async function createSQLiteMemoryRepository(
  dbPath: string,            // Path to SQLite database file
  maxTokens?: number,        // Default: 1500
  defaultImportance?: number // Default: 0.5
): Promise<AgentMemoryRepository>

// Examples
const memory1 = await createSQLiteMemoryRepository('./memories.db');
const memory2 = await createSQLiteMemoryRepository('/data/agent-memories.db', 5000, 0.6);
```

### createMemoryRepository

Creates a memory system with custom long-term storage:

```typescript
async function createMemoryRepository(
  longTerm: SQLiteMemory,
  maxTokens?: number,        // Default: 1500
  defaultImportance?: number // Default: 0.5
): Promise<AgentMemoryRepository>

// Example with custom SQLite instance
const longTerm = new SQLiteMemory('./custom-path.db');
const memory = await createMemoryRepository(longTerm, 3000, 0.8);
```

## Core Operations

### Remember

Store a new memory with importance and tags:

```typescript
async remember(
  sentence: string,      // The content to remember
  importance?: number,   // Importance score 0.0-1.0 (default: 0.5)
  tags: string[]         // Array of tags for categorization
): Promise<string>       // Returns memory ID

// Examples
const id1 = await memory.remember('User likes detailed explanations', 0.8, ['preference']);
const id2 = await memory.remember('Weather in Paris: 22°C', 0.6, ['weather', 'paris']);
const id3 = await memory.remember('Meeting scheduled for 3pm', 0.9, ['schedule', 'important']);
```

### Search

Find memories using various criteria:

```typescript
interface MemorySearchOptions {
  content?: string;        // Text search in sentences
  contentRegex?: string;   // Regex pattern for content
  tags?: string[];         // Must have ALL these tags
  tagsRegex?: string;      // Regex pattern for tags
  sortBy?: 'importance' | 'timestamp' | 'both';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

async search(options: MemorySearchOptions): Promise<AgentMemory[]>

// Examples
const recentMemories = await memory.search({
  sortBy: 'timestamp',
  sortOrder: 'desc',
  limit: 10
});

const preferences = await memory.search({
  tags: ['preference'],
  sortBy: 'importance',
  sortOrder: 'desc'
});

const weatherData = await memory.search({
  contentRegex: 'weather|temperature|forecast',
  limit: 5
});

const parisWeather = await memory.search({
  content: 'paris',
  tags: ['weather']
});
```

### Recall

Retrieve a specific memory by ID:

```typescript
async recall(id: string): Promise<AgentMemory | null>

// Example
const memory = await memory.recall('memory-id-123');
if (memory) {
  console.log(`Content: ${memory.sentence}`);
  console.log(`Importance: ${memory.importance}`);
  console.log(`Tags: ${memory.tags.join(', ')}`);
}
```

### Edit Operations

Modify existing memories:

```typescript
// Edit importance score
async editImportance(id: string, importance: number): Promise<boolean>

// Edit content
async editContent(id: string, sentence: string): Promise<boolean>

// Add tag
async addTag(id: string, tag: string): Promise<boolean>

// Remove tag
async removeTag(id: string, tag: string): Promise<boolean>

// Examples
await memory.editImportance('memory-123', 0.9);
await memory.editContent('memory-123', 'Updated content');
await memory.addTag('memory-123', 'updated');
await memory.removeTag('memory-123', 'old-tag');
```

### Forget

Remove a memory:

```typescript
async forget(id: string): Promise<boolean>

// Example
const success = await memory.forget('memory-id-123');
if (success) {
  console.log('Memory deleted');
}
```

### Statistics

Get memory system statistics:

```typescript
async getStats(): Promise<MemoryStats>

interface MemoryStats {
  totalMemories: number;
  totalTokens: number;
  averageImportance: number;
  tagCounts: Record<string, number>;
}

// Example
const stats = await memory.getStats();
console.log(`Total memories: ${stats.totalMemories}`);
console.log(`Total tokens: ${stats.totalTokens}`);
console.log(`Average importance: ${stats.averageImportance}`);
console.log('Top tags:', Object.entries(stats.tagCounts)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
);
```

## Advanced Usage Examples

### Contextual Memory Agent

```typescript
import { CubicAgent, createSQLiteMemoryRepository } from '@cubicler/cubicagentkit';

async function createContextualAgent() {
  const memory = await createSQLiteMemoryRepository('./contextual-memories.db', 3000, 0.6);
  const agent = new CubicAgent(client, server, memory);

  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userMessage = lastMessage.content || '';
    const userId = request.agent.identifier; // Use agent ID as user ID

    // Remember all interactions
    await context.memory?.remember(
      `User ${userId} said: ${userMessage}`,
      0.4,
      ['interaction', 'user_input', userId]
    );

    // Handle different types of requests
    if (userMessage.toLowerCase().includes('remember')) {
      // Extract what to remember
      const toRemember = userMessage.replace(/.*remember\s+/i, '');
      const memoryId = await context.memory?.remember(
        toRemember,
        0.8,
        ['user_request', 'important', userId]
      );
      
      return {
        type: 'text',
        content: `I'll remember: "${toRemember}" (ID: ${memoryId})`,
        usedToken: 30
      };
    }

    if (userMessage.toLowerCase().includes('what do you remember')) {
      // Get user's memories
      const userMemories = await context.memory?.search({
        tags: [userId],
        sortBy: 'importance',
        sortOrder: 'desc',
        limit: 5
      });

      if (userMemories && userMemories.length > 0) {
        const memoryList = userMemories
          .map((m, i) => `${i + 1}. ${m.sentence} (importance: ${m.importance})`)
          .join('\n');
        
        return {
          type: 'text',
          content: `Here's what I remember about you:\n${memoryList}`,
          usedToken: 50
        };
      }
    }

    // Search for relevant context
    const relevantMemories = await context.memory?.search({
      content: userMessage,
      tags: [userId],
      limit: 3
    });

    let contextualResponse = "Hello!";
    if (relevantMemories && relevantMemories.length > 0) {
      contextualResponse = `Based on our previous conversations, I remember: ${relevantMemories[0].sentence}`;
    }

    return {
      type: 'text',
      content: contextualResponse,
      usedToken: 35
    };
  });
}
```

### Learning Agent with Categories

```typescript
async function createLearningAgent() {
  const memory = await createSQLiteMemoryRepository('./learning-memories.db', 5000, 0.5);
  const agent = new CubicAgent(client, server, memory);

  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userMessage = lastMessage.content || '';

    // Categorize and learn from interactions
    let category = 'general';
    let importance = 0.5;

    if (userMessage.toLowerCase().includes('important') || userMessage.includes('!')) {
      category = 'important';
      importance = 0.9;
    } else if (userMessage.toLowerCase().includes('prefer') || userMessage.toLowerCase().includes('like')) {
      category = 'preference';
      importance = 0.8;
    } else if (userMessage.toLowerCase().includes('fact') || userMessage.toLowerCase().includes('information')) {
      category = 'fact';
      importance = 0.7;
    }

    // Store the interaction
    await context.memory?.remember(
      `User interaction: ${userMessage}`,
      importance,
      ['interaction', category, new Date().toISOString().split('T')[0]] // Include date
    );

    // Handle learning commands
    if (userMessage.toLowerCase().startsWith('learn:')) {
      const learningContent = userMessage.substring(6).trim();
      const memoryId = await context.memory?.remember(
        learningContent,
        0.9,
        ['learning', 'user_taught', category]
      );

      return {
        type: 'text',
        content: `I've learned: "${learningContent}" and categorized it as ${category}`,
        usedToken: 40
      };
    }

    // Handle knowledge queries
    if (userMessage.toLowerCase().startsWith('what do you know about')) {
      const topic = userMessage.substring(22).trim();
      const knowledge = await context.memory?.search({
        content: topic,
        tags: ['learning', 'fact'],
        sortBy: 'importance',
        limit: 5
      });

      if (knowledge && knowledge.length > 0) {
        const knowledgeList = knowledge
          .map(k => `• ${k.sentence}`)
          .join('\n');
        
        return {
          type: 'text',
          content: `Here's what I know about "${topic}":\n${knowledgeList}`,
          usedToken: 60
        };
      } else {
        return {
          type: 'text',
          content: `I don't have specific knowledge about "${topic}". You can teach me by saying "learn: [information about ${topic}]"`,
          usedToken: 30
        };
      }
    }

    // Get contextual response based on category
    const contextMemories = await context.memory?.search({
      tags: [category],
      sortBy: 'importance',
      limit: 3
    });

    let response = "I'm here to help!";
    if (contextMemories && contextMemories.length > 0) {
      response = `Based on similar ${category} topics, I remember: ${contextMemories[0].sentence}`;
    }

    return {
      type: 'text',
      content: response,
      usedToken: 35
    };
  });
}
```

### Memory Analytics Agent

```typescript
async function createAnalyticsAgent() {
  const memory = await createSQLiteMemoryRepository('./analytics-memories.db', 4000, 0.6);
  const agent = new CubicAgent(client, server, memory);

  await agent.start(async (request, client, context) => {
    const lastMessage = request.messages[request.messages.length - 1];
    const userMessage = lastMessage.content || '';

    // Store interaction with analytics tags
    await context.memory?.remember(
      `Query: ${userMessage}`,
      0.5,
      ['query', 'analytics', new Date().getHours().toString(), new Date().getDay().toString()]
    );

    if (userMessage.toLowerCase().includes('memory stats')) {
      const stats = await context.memory?.getStats();
      
      // Get top tags
      const topTags = Object.entries(stats.tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => `${tag}: ${count}`)
        .join('\n');

      // Get usage patterns
      const todayHour = new Date().getHours().toString();
      const recentQueries = await context.memory?.search({
        tags: ['query', todayHour],
        sortBy: 'timestamp',
        limit: 5
      });

      return {
        type: 'text',
        content: `Memory Statistics:
📊 Total memories: ${stats.totalMemories}
🎯 Average importance: ${stats.averageImportance.toFixed(2)}
📝 Total tokens: ${stats.totalTokens}

Top tags:
${topTags}

Recent queries this hour: ${recentQueries?.length || 0}`,
        usedToken: 100
      };
    }

    if (userMessage.toLowerCase().includes('memory search')) {
      // Interactive memory search
      const searchTerm = userMessage.replace(/.*memory search\s+/i, '');
      const results = await context.memory?.search({
        content: searchTerm,
        sortBy: 'importance',
        limit: 10
      });

      if (results && results.length > 0) {
        const resultList = results
          .map((r, i) => `${i + 1}. ${r.sentence} (${r.importance.toFixed(2)}) [${r.tags.join(', ')}]`)
          .join('\n');
        
        return {
          type: 'text',
          content: `Found ${results.length} results for "${searchTerm}":\n${resultList}`,
          usedToken: 80
        };
      } else {
        return {
          type: 'text',
          content: `No results found for "${searchTerm}"`,
          usedToken: 15
        };
      }
    }

    return {
      type: 'text',
      content: 'Ask me for "memory stats" or "memory search [term]" to explore the memory system.',
      usedToken: 25
    };
  });
}
```

## Custom Memory Implementations

### Redis Memory Backend

```typescript
import { PersistentMemory, MemoryItem, AgentMemory } from '@cubicler/cubicagentkit';
import Redis from 'ioredis';

class RedisMemory implements PersistentMemory {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url);
  }

  async initialize(): Promise<void> {
    await this.redis.ping();
  }

  async store(memory: MemoryItem): Promise<void> {
    const key = `memory:${memory.id}`;
    await this.redis.hset(key, {
      id: memory.id,
      sentence: memory.sentence,
      importance: memory.importance.toString(),
      tags: JSON.stringify(memory.tags),
      timestamp: memory.timestamp.getTime().toString()
    });

    // Add to search indexes
    for (const tag of memory.tags) {
      await this.redis.sadd(`tag:${tag}`, memory.id);
    }
  }

  async retrieve(id: string): Promise<AgentMemory | null> {
    const key = `memory:${id}`;
    const data = await this.redis.hgetall(key);
    
    if (!data.id) return null;

    return {
      id: data.id,
      sentence: data.sentence,
      importance: parseFloat(data.importance),
      tags: JSON.parse(data.tags),
      timestamp: new Date(parseInt(data.timestamp))
    };
  }

  async search(options: MemorySearchOptions): Promise<AgentMemory[]> {
    let candidateIds: string[] = [];

    if (options.tags && options.tags.length > 0) {
      // Find intersection of tag sets
      const keys = options.tags.map(tag => `tag:${tag}`);
      candidateIds = await this.redis.sinter(...keys);
    } else {
      // Get all memory IDs (limit for performance)
      candidateIds = await this.redis.scan(0, 'MATCH', 'memory:*', 'COUNT', 1000)[1];
      candidateIds = candidateIds.map(key => key.replace('memory:', ''));
    }

    // Retrieve and filter memories
    const memories: AgentMemory[] = [];
    for (const id of candidateIds) {
      const memory = await this.retrieve(id);
      if (memory && this.matchesSearch(memory, options)) {
        memories.push(memory);
      }
    }

    // Sort and limit
    return this.sortAndLimit(memories, options);
  }

  private matchesSearch(memory: AgentMemory, options: MemorySearchOptions): boolean {
    if (options.content && !memory.sentence.toLowerCase().includes(options.content.toLowerCase())) {
      return false;
    }

    if (options.contentRegex) {
      const regex = new RegExp(options.contentRegex, 'i');
      if (!regex.test(memory.sentence)) {
        return false;
      }
    }

    return true;
  }

  private sortAndLimit(memories: AgentMemory[], options: MemorySearchOptions): AgentMemory[] {
    // Sort by criteria
    if (options.sortBy === 'importance') {
      memories.sort((a, b) => b.importance - a.importance);
    } else if (options.sortBy === 'timestamp') {
      memories.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    // Reverse if ascending
    if (options.sortOrder === 'asc') {
      memories.reverse();
    }

    // Limit results
    if (options.limit) {
      memories = memories.slice(0, options.limit);
    }

    return memories;
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<boolean> {
    const existing = await this.retrieve(id);
    if (!existing) return false;

    if (updates.tags) {
      // Remove from old tag indexes
      for (const tag of existing.tags) {
        await this.redis.srem(`tag:${tag}`, id);
      }
      // Add to new tag indexes
      for (const tag of updates.tags) {
        await this.redis.sadd(`tag:${tag}`, id);
      }
    }

    // Update the memory
    const updated: MemoryItem = {
      ...existing,
      ...updates,
      timestamp: updates.timestamp || existing.timestamp
    };

    await this.store(updated);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.retrieve(id);
    if (!existing) return false;

    // Remove from tag indexes
    for (const tag of existing.tags) {
      await this.redis.srem(`tag:${tag}`, id);
    }

    // Delete the memory
    await this.redis.del(`memory:${id}`);
    return true;
  }
}

// Usage
const redisMemory = new RedisMemory('redis://localhost:6379');
const memory = await createMemoryRepository(redisMemory, 3000, 0.7);
```

## Performance Optimization

### Memory Token Management

```typescript
// Monitor token usage
const stats = await memory.getStats();
console.log(`Current token usage: ${stats.totalTokens}/1500`);

// Implement cleanup strategy
async function cleanupOldMemories(memory: AgentMemoryRepository, maxTokens: number) {
  const stats = await memory.getStats();
  
  if (stats.totalTokens > maxTokens * 0.9) { // 90% threshold
    // Get least important memories
    const candidates = await memory.search({
      sortBy: 'importance',
      sortOrder: 'asc',
      limit: 100
    });
    
    // Remove lowest importance memories until under threshold
    let tokensFreed = 0;
    for (const candidate of candidates) {
      await memory.forget(candidate.id);
      tokensFreed += candidate.sentence.length / 4; // Rough token estimate
      
      if (stats.totalTokens - tokensFreed < maxTokens * 0.8) {
        break;
      }
    }
    
    console.log(`Cleaned up ${tokensFreed} tokens from memory`);
  }
}

// Run cleanup periodically
setInterval(() => cleanupOldMemories(memory, 1500), 60000);
```

### Batch Operations

```typescript
// Batch memory operations for better performance
async function batchRemember(memory: AgentMemoryRepository, items: Array<{
  sentence: string;
  importance: number;
  tags: string[];
}>) {
  const promises = items.map(item => 
    memory.remember(item.sentence, item.importance, item.tags)
  );
  
  return await Promise.all(promises);
}

// Usage
const memoryItems = [
  { sentence: 'User prefers JSON format', importance: 0.8, tags: ['preference', 'format'] },
  { sentence: 'Meeting at 3pm tomorrow', importance: 0.9, tags: ['schedule', 'important'] },
  { sentence: 'Favorite color is blue', importance: 0.6, tags: ['preference', 'personal'] }
];

const memoryIds = await batchRemember(memory, memoryItems);
```

## Best Practices

1. **Importance Scoring**: Use consistent importance scores (0.0-1.0)
2. **Tag Strategy**: Use hierarchical tags (`user:123:preference`)
3. **Token Management**: Monitor token usage and implement cleanup
4. **Search Optimization**: Use specific tags rather than full-text search when possible
5. **Memory Lifecycle**: Regularly clean up old or irrelevant memories
6. **Backup**: Backup SQLite databases for persistent memories

## Troubleshooting

### Common Issues

**Memory Database Locked**

```
Error: database is locked
```

- Ensure only one process accesses the SQLite file
- Use WAL mode for better concurrent access
- Check file permissions

**High Memory Usage**

- Monitor token counts and implement cleanup
- Use importance-based retention policies
- Consider using external storage for large datasets

**Slow Search Performance**

- Use specific tag filters before content search
- Limit search results appropriately
- Consider indexing strategies for custom implementations

For transport-specific memory examples, see:

- [HTTP_AGENT.md](HTTP_AGENT.md) - HTTP agent with memory
- [SSE_AGENT.md](SSE_AGENT.md) - SSE agent with memory  
- [STDIO_AGENT.md](STDIO_AGENT.md) - Stdio agent with memory
