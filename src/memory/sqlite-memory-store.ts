import Database from 'better-sqlite3';
import { Memory, MemoryStore, MemoryQuery } from './memory-types.js';
import { matchesQuery, createSortComparator } from './memory-utils.js';

/**
 * SQLite-based memory store implementation
 * Provides persistent storage for long-term memories
 */
export class SQLiteMemoryStore implements MemoryStore {
  private db: Database.Database | null = null;

  /**
   * Create SQLite memory store
   * @param dbPath - Path to SQLite database file (defaults to in-memory)
   */
  constructor(private readonly dbPath: string = ':memory:') {}

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    
    // Create memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        score REAL NOT NULL,
        tags TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
      CREATE INDEX IF NOT EXISTS idx_memories_score ON memories(score);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
    `);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Store a new memory
   */
  async store(memory: Memory): Promise<Memory> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(`
      INSERT INTO memories (id, timestamp, score, tags, body)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        memory.id,
        memory.timestamp,
        memory.score,
        JSON.stringify(memory.tags),
        JSON.stringify(memory.body)
      );
      
      return memory;
    } catch (error) {
      throw new Error(`Failed to store memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve memory by ID
   */
  async retrieve(id: string): Promise<Memory | null> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(`
      SELECT id, timestamp, score, tags, body
      FROM memories
      WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    if (!row) {
      return null;
    }
    
    return this.rowToMemory(row);
  }

  /**
   * Search memories with complex criteria
   */
  async search(query: MemoryQuery): Promise<Memory[]> {
    this.ensureInitialized();
    
    // Build SQL query
    const { sql, params } = this.buildSearchQuery(query);
    
    const stmt = this.db!.prepare(sql);
    const rows = stmt.all(...params) as any[];
    
    let memories = rows.map(row => this.rowToMemory(row));
    
    // Apply client-side filters that can't be done efficiently in SQL
    if (query.tagsRegex || query.bodyRegex) {
      memories = memories.filter(memory => matchesQuery(memory, query));
    }
    
    // Apply sorting
    if (query.sortBy) {
      const comparator = createSortComparator(query.sortBy, query.sortOrder);
      memories.sort(comparator);
    }
    
    // Apply limit
    if (query.limit && query.limit > 0) {
      memories = memories.slice(0, query.limit);
    }
    
    return memories;
  }

  /**
   * Update existing memory
   */
  async update(id: string, updates: Partial<Omit<Memory, 'id'>>): Promise<Memory | null> {
    this.ensureInitialized();
    
    const existing = await this.retrieve(id);
    if (!existing) {
      return null;
    }
    
    // Merge updates
    const updated: Memory = {
      ...existing,
      ...updates,
      id // Ensure ID doesn't change
    };
    
    const stmt = this.db!.prepare(`
      UPDATE memories
      SET timestamp = ?, score = ?, tags = ?, body = ?
      WHERE id = ?
    `);
    
    try {
      const result = stmt.run(
        updated.timestamp,
        updated.score,
        JSON.stringify(updated.tags),
        JSON.stringify(updated.body),
        id
      );
      
      return result.changes > 0 ? updated : null;
    } catch (error) {
      throw new Error(`Failed to update memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete memory by ID
   */
  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(`DELETE FROM memories WHERE id = ?`);
    const result = stmt.run(id);
    
    return result.changes > 0;
  }

  /**
   * Get total count of memories
   */
  async count(): Promise<number> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(`SELECT COUNT(*) as count FROM memories`);
    const result = stmt.get() as { count: number };
    
    return result.count;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Build SQL query from search parameters
   * @private
   */
  private buildSearchQuery(query: MemoryQuery): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    
    // ID exact match
    if (query.id) {
      conditions.push('id = ?');
      params.push(query.id);
    }
    
    // Score range
    if (query.scoreMin !== undefined) {
      conditions.push('score >= ?');
      params.push(query.scoreMin);
    }
    if (query.scoreMax !== undefined) {
      conditions.push('score <= ?');
      params.push(query.scoreMax);
    }
    
    // Timestamp range
    if (query.timestampAfter !== undefined) {
      conditions.push('timestamp > ?');
      params.push(query.timestampAfter);
    }
    if (query.timestampBefore !== undefined) {
      conditions.push('timestamp < ?');
      params.push(query.timestampBefore);
    }
    
    // Tags exact match (basic containment check in SQL)
    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => 'tags LIKE ?');
      conditions.push(`(${tagConditions.join(' AND ')})`);
      query.tags.forEach(tag => {
        params.push(`%"${tag}"%`); // JSON array containment
      });
    }
    
    // Build WHERE clause
    let sql = 'SELECT id, timestamp, score, tags, body FROM memories';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Basic ordering in SQL (client-side sorting will override if needed)
    if (query.sortBy === 'timestamp') {
      sql += ` ORDER BY timestamp ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (query.sortBy === 'score') {
      sql += ` ORDER BY score ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else {
      sql += ' ORDER BY timestamp DESC'; // Default: newest first
    }
    
    return { sql, params };
  }

  /**
   * Convert database row to Memory object
   * @private
   */
  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      timestamp: row.timestamp,
      score: row.score,
      tags: JSON.parse(row.tags),
      body: JSON.parse(row.body)
    };
  }

  /**
   * Ensure database is initialized
   * @private
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('SQLiteMemoryStore not initialized. Call initialize() first.');
    }
  }
}