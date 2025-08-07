import { describe, it, expect } from 'vitest';

// Import everything from the main index to test exports
import {
  // Core classes
  CubicAgent,
  HttpAgentClient,
  HttpAgentServer,
  SSEAgentServer,
  StdioAgentClient,
  StdioAgentServer,
  
  // Memory system
  AgentMemoryRepository,
  SQLiteMemory,
  LRUShortTermMemory,
  createDefaultMemoryRepository,
  createSQLiteMemoryRepository,
  createMemoryRepository,
  
  // JWT Authentication
  StaticJWTAuthProvider,
  OAuthJWTAuthProvider,
  createJWTAuthProvider,
  createJWTMiddleware,
  createOptionalJWTMiddleware,
  
  // Types are not runtime imports but we test the module structure
} from '../src/index.js';

describe('Index exports', () => {
  describe('Core classes', () => {
    it('should export CubicAgent', () => {
      expect(CubicAgent).toBeDefined();
      expect(typeof CubicAgent).toBe('function');
    });

    it('should export HttpAgentClient', () => {
      expect(HttpAgentClient).toBeDefined();
      expect(typeof HttpAgentClient).toBe('function');
    });

    it('should export HttpAgentServer', () => {
      expect(HttpAgentServer).toBeDefined();
      expect(typeof HttpAgentServer).toBe('function');
    });

    it('should export SSEAgentServer', () => {
      expect(SSEAgentServer).toBeDefined();
      expect(typeof SSEAgentServer).toBe('function');
    });

    it('should export StdioAgentClient', () => {
      expect(StdioAgentClient).toBeDefined();
      expect(typeof StdioAgentClient).toBe('function');
    });

    it('should export StdioAgentServer', () => {
      expect(StdioAgentServer).toBeDefined();
      expect(typeof StdioAgentServer).toBe('function');
    });
  });

  describe('Memory system', () => {
    it('should export AgentMemoryRepository', () => {
      expect(AgentMemoryRepository).toBeDefined();
      expect(typeof AgentMemoryRepository).toBe('function');
    });

    it('should export SQLiteMemory', () => {
      expect(SQLiteMemory).toBeDefined();
      expect(typeof SQLiteMemory).toBe('function');
    });

    it('should export LRUShortTermMemory', () => {
      expect(LRUShortTermMemory).toBeDefined();
      expect(typeof LRUShortTermMemory).toBe('function');
    });

    it('should export createDefaultMemoryRepository', () => {
      expect(createDefaultMemoryRepository).toBeDefined();
      expect(typeof createDefaultMemoryRepository).toBe('function');
    });

    it('should export createSQLiteMemoryRepository', () => {
      expect(createSQLiteMemoryRepository).toBeDefined();
      expect(typeof createSQLiteMemoryRepository).toBe('function');
    });

    it('should export createMemoryRepository', () => {
      expect(createMemoryRepository).toBeDefined();
      expect(typeof createMemoryRepository).toBe('function');
    });
  });

  describe('JWT Authentication', () => {
    it('should export StaticJWTAuthProvider', () => {
      expect(StaticJWTAuthProvider).toBeDefined();
      expect(typeof StaticJWTAuthProvider).toBe('function');
    });

    it('should export OAuthJWTAuthProvider', () => {
      expect(OAuthJWTAuthProvider).toBeDefined();
      expect(typeof OAuthJWTAuthProvider).toBe('function');
    });

    it('should export createJWTAuthProvider', () => {
      expect(createJWTAuthProvider).toBeDefined();
      expect(typeof createJWTAuthProvider).toBe('function');
    });

    it('should export createJWTMiddleware', () => {
      expect(createJWTMiddleware).toBeDefined();
      expect(typeof createJWTMiddleware).toBe('function');
    });

    it('should export createOptionalJWTMiddleware', () => {
      expect(createOptionalJWTMiddleware).toBeDefined();
      expect(typeof createOptionalJWTMiddleware).toBe('function');
    });
  });

  describe('Memory factory functions', () => {
    it('should create working memory repository', async () => {
      const repository = await createDefaultMemoryRepository();
      expect(repository).toBeDefined();
      expect(typeof repository.remember).toBe('function');
      expect(typeof repository.search).toBe('function');
      expect(typeof repository.forget).toBe('function');
    });

    it('should create SQLite memory repository', async () => {
      const repository = await createSQLiteMemoryRepository(':memory:');
      expect(repository).toBeDefined();
      expect(typeof repository.remember).toBe('function');
      expect(typeof repository.search).toBe('function');
      expect(typeof repository.forget).toBe('function');
    });

    it('should create memory repository with custom config', async () => {
      const longTerm = new SQLiteMemory(':memory:');
      const repository = await createMemoryRepository(longTerm, 50, 0.7);
      expect(repository).toBeDefined();
      expect(typeof repository.remember).toBe('function');
      expect(typeof repository.search).toBe('function');
      expect(typeof repository.forget).toBe('function');
    });
  });

  describe('JWT provider factory functions', () => {
    it('should create static JWT provider', () => {
      const config = {
        type: 'static' as const,
        token: 'test-token'
      };
      const provider = createJWTAuthProvider(config);
      expect(provider).toBeDefined();
      expect(typeof provider.getToken).toBe('function');
      expect(typeof provider.isTokenValid).toBe('function');
      expect(typeof provider.refreshToken).toBe('function');
    });

    it('should create OAuth JWT provider', () => {
      const config = {
        type: 'oauth' as const,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        tokenEndpoint: 'https://example.com/token'
      };
      const provider = createJWTAuthProvider(config);
      expect(provider).toBeDefined();
      expect(typeof provider.getToken).toBe('function');
      expect(typeof provider.isTokenValid).toBe('function');
      expect(typeof provider.refreshToken).toBe('function');
    });
  });

  describe('JWT middleware factory functions', () => {
    it('should create JWT middleware', () => {
      const config = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };
      const middleware = createJWTMiddleware(config);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create optional JWT middleware', () => {
      const config = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };
      const middleware = createOptionalJWTMiddleware(config);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Core class instantiation', () => {
    it('should be able to instantiate HttpAgentClient', () => {
      const client = new HttpAgentClient('http://localhost:3000');
      expect(client).toBeInstanceOf(HttpAgentClient);
      expect(typeof client.initialize).toBe('function');
      expect(typeof client.callTool).toBe('function');
    });

    it('should be able to instantiate HttpAgentServer', () => {
      const server = new HttpAgentServer(3000);
      expect(server).toBeInstanceOf(HttpAgentServer);
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
    });

    it('should be able to instantiate StdioAgentClient', () => {
      const client = new StdioAgentClient('node', ['--version']);
      expect(client).toBeInstanceOf(StdioAgentClient);
      expect(typeof client.initialize).toBe('function');
      expect(typeof client.callTool).toBe('function');
    });

    it('should be able to instantiate memory classes', () => {
      const sqliteMemory = new SQLiteMemory(':memory:');
      expect(sqliteMemory).toBeInstanceOf(SQLiteMemory);
      expect(typeof sqliteMemory.store).toBe('function');
      expect(typeof sqliteMemory.search).toBe('function');

      const lruMemory = new LRUShortTermMemory(1000);
      expect(lruMemory).toBeInstanceOf(LRUShortTermMemory);
      expect(typeof lruMemory.get).toBe('function');
      expect(typeof lruMemory.put).toBe('function');

      const repository = new AgentMemoryRepository(sqliteMemory, lruMemory);
      expect(repository).toBeInstanceOf(AgentMemoryRepository);
      expect(typeof repository.remember).toBe('function');
      expect(typeof repository.search).toBe('function');
    });
  });
});
