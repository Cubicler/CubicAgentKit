import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { SSEAgentServer } from '../../src/server/sse-agent-server.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('SSEAgentServer', () => {
  let server: SSEAgentServer;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      post: vi.fn().mockResolvedValue({ data: {} })
    } as unknown as AxiosInstance;

    (mockedAxios.create as any).mockReturnValue(mockAxiosInstance);

    server = new SSEAgentServer('http://localhost:8080', 'test-agent');
  });

  describe('constructor', () => {
    it('should create SSEAgentServer with correct configuration', () => {
      expect(server).toBeInstanceOf(SSEAgentServer);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8080',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should allow custom timeout', () => {
      const customServer = new SSEAgentServer('http://localhost:8080', 'test-agent', 10000);
      expect(customServer).toBeInstanceOf(SSEAgentServer);
      expect(mockedAxios.create).toHaveBeenLastCalledWith({
        baseURL: 'http://localhost:8080',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });
  });

  describe('stop', () => {
    it('should handle stop when not running', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });
});