import { Memory, ShortTermMemory } from './memory-types.js';
import { countWords } from './memory-utils.js';

/**
 * Node for doubly-linked list in LRU implementation
 */
class LRUNode {
  constructor(
    public memory: Memory,
    public prev: LRUNode | null = null,
    public next: LRUNode | null = null
  ) {}
}

/**
 * LRU-based short-term memory implementation
 * Maintains memories in-memory with word-based capacity management
 */
export class LRUShortTermMemory implements ShortTermMemory {
  private memoryMap = new Map<string, LRUNode>();
  private head: LRUNode | null = null; // Most recently used
  private tail: LRUNode | null = null; // Least recently used
  private currentWordCount = 0;

  constructor(private readonly maxWordCount: number) {}

  /**
   * Get memory from cache (moves to front if found)
   */
  get(id: string): Memory | null {
    const node = this.memoryMap.get(id);
    if (!node) {
      return null;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    return node.memory;
  }

  /**
   * Put memory in cache (may evict LRU items)
   */
  put(memory: Memory): Memory | null {
    const existingNode = this.memoryMap.get(memory.id);
    
    if (existingNode) {
      // Update existing memory
      const oldWordCount = countWords(existingNode.memory.body);
      const newWordCount = countWords(memory.body);
      
      existingNode.memory = memory;
      this.currentWordCount = this.currentWordCount - oldWordCount + newWordCount;
      
      // Move to front
      this.moveToFront(existingNode);
      
      // Check if we need to evict due to increased word count
      return this.evictIfNeeded();
    }

    // Add new memory
    const newWordCount = countWords(memory.body);
    const newNode = new LRUNode(memory);
    
    this.memoryMap.set(memory.id, newNode);
    this.currentWordCount += newWordCount;
    
    // Add to front
    this.addToFront(newNode);
    
    // Evict if needed
    return this.evictIfNeeded();
  }

  /**
   * Remove memory from cache
   */
  remove(id: string): Memory | null {
    const node = this.memoryMap.get(id);
    if (!node) {
      return null;
    }

    this.removeNode(node);
    this.memoryMap.delete(id);
    this.currentWordCount -= countWords(node.memory.body);
    
    return node.memory;
  }

  /**
   * Get all memories in cache (most recently used first)
   */
  getAll(): Memory[] {
    const memories: Memory[] = [];
    let current = this.head;
    
    while (current) {
      memories.push(current.memory);
      current = current.next;
    }
    
    return memories;
  }

  /**
   * Get current word count
   */
  getCurrentWordCount(): number {
    return this.currentWordCount;
  }

  /**
   * Get maximum word capacity
   */
  getMaxWordCount(): number {
    return this.maxWordCount;
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memoryMap.clear();
    this.head = null;
    this.tail = null;
    this.currentWordCount = 0;
  }

  /**
   * Move node to front of the list (most recently used)
   * @private
   */
  private moveToFront(node: LRUNode): void {
    if (node === this.head) {
      return; // Already at front
    }

    // Remove from current position
    this.removeNode(node);
    
    // Add to front
    this.addToFront(node);
  }

  /**
   * Add node to front of the list
   * @private
   */
  private addToFront(node: LRUNode): void {
    node.prev = null;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from the list
   * @private
   */
  private removeNode(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Evict least recently used items if over capacity
   * @private
   */
  private evictIfNeeded(): Memory | null {
    let evictedMemory: Memory | null = null;
    
    while (this.currentWordCount > this.maxWordCount && this.tail) {
      const evicted = this.evictLRU();
      if (evicted && !evictedMemory) {
        evictedMemory = evicted; // Return the first evicted memory
      }
    }
    
    return evictedMemory;
  }

  /**
   * Evict the least recently used item
   * @private
   */
  private evictLRU(): Memory | null {
    if (!this.tail) {
      return null;
    }

    const evictedNode = this.tail;
    this.removeNode(evictedNode);
    this.memoryMap.delete(evictedNode.memory.id);
    this.currentWordCount -= countWords(evictedNode.memory.body);
    
    return evictedNode.memory;
  }
}