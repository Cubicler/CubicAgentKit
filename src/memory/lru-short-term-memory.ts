import { AgentMemory } from '../interface/memory-repository.js';
import { ShortTermMemory } from '../interface/short-term-memory.js';
import { MemoryItem } from '../model/memory.js';
import { countWords } from '../utils/memory-utils.js';

/**
 * Node for doubly-linked list in LRU implementation
 */
class LRUNode {
  constructor(
    public memory: MemoryItem,
    public prev: LRUNode | null = null,
    public next: LRUNode | null = null
  ) {}
}

/**
 * LRU-based short-term memory for sentences with token-based capacity
 */
export class LRUShortTermMemory implements ShortTermMemory {
  private readonly memoryMap = new Map<string, LRUNode>();
  private head: LRUNode | null = null; // Most recently used
  private tail: LRUNode | null = null; // Least recently used
  private currentTokenCount = 0;

  constructor(private readonly maxTokenCount: number) {}

  /**
   * Get memory from cache (moves to front if found)
   */
  get(id: string): AgentMemory | null {
    const node = this.memoryMap.get(id);
    if (!node) {
      return null;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    return this.nodeToAgentMemory(node);
  }

  /**
   * Put memory in cache (may evict LRU items)
   */
  put(memory: MemoryItem): MemoryItem | null {
    const existingNode = this.memoryMap.get(memory.id);
    
    if (existingNode) {
      // Update existing memory
      const oldTokenCount = countWords(existingNode.memory.sentence);
      const newTokenCount = countWords(memory.sentence);
      
      existingNode.memory = memory;
      this.currentTokenCount = this.currentTokenCount - oldTokenCount + newTokenCount;
      
      // Move to front
      this.moveToFront(existingNode);
      
      // Check if we need to evict due to increased token count
      return this.evictIfNeeded();
    }

    // Add new memory
    const newTokenCount = countWords(memory.sentence);
    const newNode = new LRUNode(memory);
    
    this.memoryMap.set(memory.id, newNode);
    this.currentTokenCount += newTokenCount;
    
    // Add to front
    this.addToFront(newNode);
    
    // Evict if needed
    return this.evictIfNeeded();
  }

  /**
   * Remove memory from cache
   */
  remove(id: string): AgentMemory | null {
    const node = this.memoryMap.get(id);
    if (!node) {
      return null;
    }

    this.removeNode(node);
    this.memoryMap.delete(id);
    this.currentTokenCount -= countWords(node.memory.sentence);
    
    return this.nodeToAgentMemory(node);
  }

  /**
   * Get all memories in cache (most recently used first)
   */
  getAll(): AgentMemory[] {
    const memories: AgentMemory[] = [];
    let current = this.head;
    
    while (current) {
      memories.push(this.nodeToAgentMemory(current));
      current = current.next;
    }
    
    return memories;
  }

  /**
   * Get current token count
   */
  getCurrentTokenCount(): number {
    return this.currentTokenCount;
  }

  /**
   * Get maximum token capacity
   */
  getMaxTokenCount(): number {
    return this.maxTokenCount;
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memoryMap.clear();
    this.head = null;
    this.tail = null;
    this.currentTokenCount = 0;
  }

  /**
   * Convert internal node to AgentMemory
   */
  private nodeToAgentMemory(node: LRUNode): AgentMemory {
    return new AgentMemory(
      node.memory.id,
      node.memory.sentence,
      node.memory.importance,
      [...node.memory.tags] // Clone array to prevent mutation
    );
  }

  /**
   * Move node to front of the list (most recently used)
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
   */
  private evictIfNeeded(): MemoryItem | null {
    let evictedMemory: MemoryItem | null = null;
    
    while (this.currentTokenCount > this.maxTokenCount && this.tail) {
      const evicted = this.evictLRU();
      if (evicted && !evictedMemory) {
        evictedMemory = evicted; // Return the first evicted memory
      }
    }
    
    return evictedMemory;
  }

  /**
   * Evict the least recently used item
   */
  private evictLRU(): MemoryItem | null {
    if (!this.tail) {
      return null;
    }

    const evictedNode = this.tail;
    this.removeNode(evictedNode);
    this.memoryMap.delete(evictedNode.memory.id);
    this.currentTokenCount -= countWords(evictedNode.memory.sentence);
    
    return evictedNode.memory;
  }
}
