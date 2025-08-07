import { AgentMemory, MemorySearchOptions } from '../interface/memory-repository.js';
import { PersistentMemory } from '../interface/persistent-memory.js';
import { MemoryItem } from '../model/memory.js';
import Database from 'better-sqlite3';

// SQLite row interfaces for type safety
interface MemoryRow {
  id: string;
  sentence: string;
  importance: number;
  timestamp: number;
}

interface TagRow {
  id: number;
  tag: string;
}

interface CountRow {
  count: number;
}

interface PageCountRow {
  page_count: number;
}

/**
 * SQLite-based persistent memory storage
 * Provides durable storage for long-term agent memories
 */
export class SQLiteMemory implements PersistentMemory {
  private db: Database.Database | null = null;

  /**
   * Create SQLite memory store
   * @param dbPath - Path to SQLite database file (defaults to in-memory if not provided)
   */
  constructor(private readonly dbPath: string = ':memory:') {}

  /**
   * Initialize the SQLite database and create tables
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    
    // Enable foreign key constraints
    this.db.exec('PRAGMA foreign_keys = ON');
    
    // Add custom REGEXP function for regex support
    this.db.function('regexp', { deterministic: true }, (pattern: string, text: string) => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(text) ? 1 : 0; // SQLite needs 1/0 instead of true/false
      } catch {
        return 0; // Invalid regex returns false (0)
      }
    });
    
    // Create memories table (without tags column)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        sentence TEXT NOT NULL,
        importance REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT UNIQUE NOT NULL
      )
    `);

    // Create memory_tags junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_tags (
        memory_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (memory_id, tag_id),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Create index on timestamp for faster sorting
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp)
    `);

    // Create index on importance for faster sorting
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)
    `);

    // Create index on tag for faster tag searches
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)
    `);
  }

  /**
   * Get or create tag ID for a given tag string
   */
  private getOrCreateTagId(tagText: string): number {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    // Try to get existing tag
    const selectStmt = this.db.prepare('SELECT id FROM tags WHERE tag = ?');
    const existingTag = selectStmt.get(tagText) as TagRow | undefined;
    
    if (existingTag) {
      return existingTag.id;
    }

    // Create new tag
    const insertStmt = this.db.prepare('INSERT INTO tags (tag) VALUES (?)');
    const result = insertStmt.run(tagText);
    return result.lastInsertRowid as number;
  }

  /**
   * Get tags for a memory by memory ID
   */
  private getTagsForMemory(memoryId: string): string[] {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    const stmt = this.db.prepare(`
      SELECT t.tag 
      FROM tags t
      JOIN memory_tags mt ON t.id = mt.tag_id
      WHERE mt.memory_id = ?
      ORDER BY t.tag
    `);
    
    const rows = stmt.all(memoryId) as { tag: string }[];
    return rows.map(row => row.tag);
  }

  /**
   * Store tags for a memory
   */
  private storeTagsForMemory(memoryId: string, tags: string[]): void {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    // First, remove existing tags for this memory
    const deleteStmt = this.db.prepare('DELETE FROM memory_tags WHERE memory_id = ?');
    deleteStmt.run(memoryId);

    // Insert new tags
    const insertStmt = this.db.prepare('INSERT INTO memory_tags (memory_id, tag_id) VALUES (?, ?)');
    
    for (const tag of tags) {
      const tagId = this.getOrCreateTagId(tag);
      insertStmt.run(memoryId, tagId);
    }
  }

  /**
   * Store a new memory in SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async store(memory: MemoryItem): Promise<void> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    // Begin transaction
    const transaction = this.db.transaction(() => {
      // Insert memory without tags
      const memoryStmt = this.db?.prepare(`
        INSERT INTO memories (id, sentence, importance, timestamp)
        VALUES (?, ?, ?, ?)
      `);

      if (!memoryStmt) {
        throw new Error('Failed to prepare memory statement');
      }

      memoryStmt.run(
        memory.id,
        memory.sentence,
        memory.importance,
        memory.timestamp
      );

      // Store tags
      this.storeTagsForMemory(memory.id, memory.tags);
    });

    transaction();
  }

  /**
   * Retrieve memory by ID from SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async retrieve(id: string): Promise<AgentMemory | null> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    const stmt = this.db.prepare(`
      SELECT id, sentence, importance, timestamp
      FROM memories
      WHERE id = ?
    `);

    const row = stmt.get(id) as MemoryRow | undefined;
    if (!row) {
      return null;
    }

    // Get tags for this memory
    const tags = this.getTagsForMemory(row.id);

    return new AgentMemory(
      row.id,
      row.sentence,
      row.importance,
      tags
    );
  }

  /**
   * Search memories with complex criteria using SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async search(options: MemorySearchOptions): Promise<AgentMemory[]> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    let query = 'SELECT DISTINCT m.id, m.sentence, m.importance, m.timestamp FROM memories m';
    const params: (string | number)[] = [];
    const whereClauses: string[] = [];

    // Join with tags if any tag-related filters are specified
    const needsTagJoin = (options.tags && options.tags.length > 0) || options.tagsRegex;
    if (needsTagJoin) {
      query += ' JOIN memory_tags mt ON m.id = mt.memory_id JOIN tags t ON mt.tag_id = t.id';
      
      // Handle exact tag matching
      if (options.tags && options.tags.length > 0) {
        const tagPlaceholders = options.tags.map(() => '?').join(',');
        whereClauses.push(`t.tag IN (${tagPlaceholders})`);
        params.push(...options.tags);
      }
      
      // Handle tag regex matching with SQLite REGEXP function
      if (options.tagsRegex) {
        whereClauses.push(`t.tag REGEXP ?`);
        params.push(options.tagsRegex);
      }
    }

    // Add content search if specified
    if (options.content) {
      whereClauses.push('m.sentence LIKE ?');
      params.push(`%${options.content}%`);
    }

    // Add content regex search if specified
    if (options.contentRegex) {
      // Use native SQLite REGEXP function for better performance
      whereClauses.push('m.sentence REGEXP ?');
      params.push(options.contentRegex);
    }

    // Add WHERE clause if we have conditions
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Add sorting
    const sortBy = options.sortBy ?? 'both';
    const sortOrder = options.sortOrder ?? 'desc';
    
    if (sortBy === 'importance') {
      query += ` ORDER BY m.importance ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'timestamp') {
      query += ` ORDER BY m.timestamp ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'both') {
      // Sort by importance first, then timestamp
      query += ` ORDER BY m.importance ${sortOrder.toUpperCase()}, m.timestamp ${sortOrder.toUpperCase()}`;
    }

    // Add limit
    if (options.limit && options.limit > 0) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as MemoryRow[];

    // Convert to AgentMemory objects
    // All filtering is now handled natively by SQLite
    const results: AgentMemory[] = [];
    
    for (const row of rows) {
      const tags = this.getTagsForMemory(row.id);
      const agentMemory = new AgentMemory(
        row.id,
        row.sentence,
        row.importance,
        tags
      );
      
      results.push(agentMemory);
    }

    return results;
  }

  /**
   * Update existing memory in SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async update(id: string, updates: Partial<Pick<MemoryItem, 'sentence' | 'importance' | 'tags'>>): Promise<boolean> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    const setParts: string[] = [];
    const params: (string | number)[] = [];

    if (updates.sentence !== undefined) {
      setParts.push('sentence = ?');
      params.push(updates.sentence);
    }
    if (updates.importance !== undefined) {
      setParts.push('importance = ?');
      params.push(updates.importance);
    }

    if (setParts.length === 0 && !updates.tags) {
      return false; // Nothing to update
    }

    // Update timestamp to current time
    setParts.push('timestamp = ?');
    params.push(Date.now());

    let memoryUpdated = false;

    // Begin transaction for atomic updates
    const transaction = this.db.transaction(() => {
      // Update memory fields if any
      if (setParts.length > 1) { // More than just timestamp
        params.push(id); // For WHERE clause
        const query = `UPDATE memories SET ${setParts.join(', ')} WHERE id = ?`;
        const stmt = this.db?.prepare(query);
        if (!stmt) {
          throw new Error('Failed to prepare update statement');
        }
        const result = stmt.run(...params);
        memoryUpdated = result.changes > 0;
      } else {
        // Check if memory exists
        const checkStmt = this.db?.prepare('SELECT 1 FROM memories WHERE id = ?');
        if (!checkStmt) {
          throw new Error('Failed to prepare check statement');
        }
        memoryUpdated = checkStmt.get(id) !== undefined;
      }

      // Update tags if specified
      if (updates.tags !== undefined && memoryUpdated) {
        this.storeTagsForMemory(id, updates.tags);
      }
    });

    transaction();
    return memoryUpdated;
  }

  /**
   * Delete memory by ID from SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async delete(id: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    // The foreign key constraint with CASCADE will automatically delete related memory_tags
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);
    
    // Clean up orphaned tags (tags not referenced by any memory)
    this.cleanupOrphanedTags();
    
    return result.changes > 0;
  }

  /**
   * Clean up tags that are no longer referenced by any memory
   */
  private cleanupOrphanedTags(): void {
    if (!this.db) {
      return;
    }

    const stmt = this.db.prepare(`
      DELETE FROM tags 
      WHERE id NOT IN (
        SELECT DISTINCT tag_id FROM memory_tags
      )
    `);
    stmt.run();
  }

  /**
   * Get total count of memories in SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async count(): Promise<number> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM memories');
    const result = stmt.get() as CountRow;
    
    return result.count;
  }

  /**
   * Close SQLite database connection
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database file path
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Vacuum the database to reclaim space
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async vacuum(): Promise<void> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    this.db.exec('VACUUM');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    databaseSize: number;
    oldestMemory?: AgentMemory;
    newestMemory?: AgentMemory;
  }> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    const totalMemories = await this.count();
    
    // Get database file size (for file-based databases)
    let databaseSize = 0;
    if (this.dbPath !== ':memory:') {
      const pageSizeResult = this.db.prepare('PRAGMA page_count').get() as PageCountRow;
      databaseSize = pageSizeResult.page_count;
    }
    
    // Get oldest memory
    const oldestStmt = this.db.prepare('SELECT id, sentence, importance FROM memories ORDER BY timestamp ASC LIMIT 1');
    const oldestRow = oldestStmt.get() as MemoryRow | undefined;
    const oldestMemory = oldestRow ? new AgentMemory(
      oldestRow.id, 
      oldestRow.sentence, 
      oldestRow.importance, 
      this.getTagsForMemory(oldestRow.id)
    ) : undefined;
    
    // Get newest memory
    const newestStmt = this.db.prepare('SELECT id, sentence, importance FROM memories ORDER BY timestamp DESC LIMIT 1');
    const newestRow = newestStmt.get() as MemoryRow | undefined;
    const newestMemory = newestRow ? new AgentMemory(
      newestRow.id, 
      newestRow.sentence, 
      newestRow.importance, 
      this.getTagsForMemory(newestRow.id)
    ) : undefined;

    return {
      totalMemories,
      databaseSize,
      oldestMemory,
      newestMemory
    };
  }
}
