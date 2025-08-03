import { AgentMemory, MemorySearchOptions } from '../interface/memory-repository.js';
import { PersistentMemory } from '../interface/persistent-memory.js';
import { MemoryItem } from '../model/memory.js';
import { matchesSearchCriteria } from '../utils/memory-utils.js';
import Database from 'better-sqlite3';

// SQLite row interfaces for type safety
interface MemoryRow {
  id: string;
  sentence: string;
  importance: number;
  tags: string;
  timestamp: number;
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
    
    // Create memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        sentence TEXT NOT NULL,
        importance REAL NOT NULL,
        tags TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  }

  /**
   * Store a new memory in SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async store(memory: MemoryItem): Promise<void> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, sentence, importance, tags, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      memory.id,
      memory.sentence,
      memory.importance,
      JSON.stringify(memory.tags),
      memory.timestamp
    );
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
      SELECT id, sentence, importance, tags, timestamp
      FROM memories
      WHERE id = ?
    `);

    const row = stmt.get(id) as MemoryRow | undefined;
    if (!row) {
      return null;
    }

    return new AgentMemory(
      row.id,
      row.sentence,
      row.importance,
      JSON.parse(row.tags) as string[]
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

    let query = 'SELECT id, sentence, importance, tags, timestamp FROM memories WHERE 1=1';
    const params: (string | number)[] = [];

    // Add content search if specified
    if (options.content) {
      query += ' AND sentence LIKE ?';
      params.push(`%${options.content}%`);
    }

    // Add content regex search if specified
    if (options.contentRegex) {
      // SQLite doesn't have native regex, we'll filter in memory later
      query += ' AND sentence LIKE ?';
      params.push(`%${options.contentRegex}%`); // Basic LIKE for initial filtering
    }

    // Add sorting
    const sortBy = options.sortBy ?? 'both';
    const sortOrder = options.sortOrder ?? 'desc';
    
    if (sortBy === 'importance') {
      query += ` ORDER BY importance ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'timestamp') {
      query += ` ORDER BY timestamp ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'both') {
      // Sort by importance first, then timestamp
      query += ` ORDER BY importance ${sortOrder.toUpperCase()}, timestamp ${sortOrder.toUpperCase()}`;
    }

    // Add limit
    if (options.limit && options.limit > 0) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as MemoryRow[];

    // Convert to AgentMemory objects and apply additional filtering
    const results: AgentMemory[] = [];
    
    for (const row of rows) {
      const agentMemory = new AgentMemory(
        row.id,
        row.sentence,
        row.importance,
        JSON.parse(row.tags) as string[]
      );

      // Apply additional filters that couldn't be done in SQL
      if (matchesSearchCriteria(agentMemory, options)) {
        results.push(agentMemory);
      }
    }

    // Apply regex filtering if needed
    if (options.contentRegex) {
      const regex = new RegExp(options.contentRegex, 'i');
      return results.filter(memory => regex.test(memory.sentence));
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
    if (updates.tags !== undefined) {
      setParts.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }

    if (setParts.length === 0) {
      return false; // Nothing to update
    }

    // Update timestamp to current time
    setParts.push('timestamp = ?');
    params.push(Date.now());

    params.push(id); // For WHERE clause

    const query = `UPDATE memories SET ${setParts.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);

    return result.changes > 0;
  }

  /**
   * Delete memory by ID from SQLite
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Interface requires async
  async delete(id: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('SQLiteMemory not initialized. Call initialize() first.');
    }

    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);
    
    return result.changes > 0;
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
    const oldestStmt = this.db.prepare('SELECT id, sentence, importance, tags FROM memories ORDER BY timestamp ASC LIMIT 1');
    const oldestRow = oldestStmt.get() as MemoryRow | undefined;
    const oldestMemory = oldestRow ? new AgentMemory(oldestRow.id, oldestRow.sentence, oldestRow.importance, JSON.parse(oldestRow.tags) as string[]) : undefined;
    
    // Get newest memory
    const newestStmt = this.db.prepare('SELECT id, sentence, importance, tags FROM memories ORDER BY timestamp DESC LIMIT 1');
    const newestRow = newestStmt.get() as MemoryRow | undefined;
    const newestMemory = newestRow ? new AgentMemory(newestRow.id, newestRow.sentence, newestRow.importance, JSON.parse(newestRow.tags) as string[]) : undefined;

    return {
      totalMemories,
      databaseSize,
      oldestMemory,
      newestMemory
    };
  }
}
