import axios from 'axios';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CubiclerClient } from '../../src/agent/cubicler-client';
import { ProviderSpecResponse, FunctionCallResult } from '../../src/models/types';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn()
    })),
    get: vi.fn(),
    post: vi.fn()
  }
}));

const mockedAxios = axios as any;
const mockedAxiosInstance = {
  get: vi.fn(),
  post: vi.fn()
};

// Mock axios.create to return our mocked instance
mockedAxios.create.mockReturnValue(mockedAxiosInstance);

describe('CubiclerClient', () => {
  let client: CubiclerClient;

  beforeEach(() => {
    client = new CubiclerClient(
      'http://localhost:1503',
      5000,
      2
    );
    vi.clearAllMocks();
    // Reset the mocked axios instance completely
    mockedAxiosInstance.get.mockReset();
    mockedAxiosInstance.post.mockReset();
  });

  describe('constructor', () => {
    it('should create client with provided config', () => {
      expect(client).toBeInstanceOf(CubiclerClient);
    });

    it('should use default values when not provided', () => {
      const defaultClient = new CubiclerClient('http://localhost:1503');
      expect(defaultClient).toBeInstanceOf(CubiclerClient);
    });
  });

  describe('getProviderSpec', () => {
    const mockProviderSpec: ProviderSpecResponse = {
      context: 'Weather API context',
      functions: [
        {
          name: 'getWeather',
          description: 'Get weather information',
          parameters: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                required: true
              }
            },
            required: ['city']
          }
        }
      ]
    };

    it('should successfully fetch provider spec', async () => {
      mockedAxiosInstance.get.mockResolvedValueOnce({
        data: mockProviderSpec
      });

      const result = await client.getProviderSpec('weather_api');

      expect(mockedAxiosInstance.get).toHaveBeenCalledWith(
        '/provider/weather_api/spec'
      );
      expect(result).toEqual(mockProviderSpec);
    });

    it('should retry on failure and eventually succeed', async () => {
      // Reset all mocks to ensure clean state
      mockedAxiosInstance.get.mockReset();

      mockedAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: mockProviderSpec });

      const result = await client.getProviderSpec('weather_api');

      expect(mockedAxiosInstance.get).toHaveBeenCalledTimes(2); // 2 total attempts
      expect(result).toEqual(mockProviderSpec);
    });

    it('should throw error after max retries', async () => {
      // Reset all mocks to ensure clean state
      mockedAxiosInstance.get.mockReset();

      const error = new Error('Persistent network error');
      mockedAxiosInstance.get.mockRejectedValue(error);

      await expect(client.getProviderSpec('weather_api'))
        .rejects.toThrow('Failed to get provider spec for weather_api: Persistent network error');

      expect(mockedAxiosInstance.get).toHaveBeenCalledTimes(2); // 2 total attempts
    });

    it('should handle axios error with response', async () => {
      const axiosError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Provider not found' }
        },
        message: 'Request failed'
      };
      mockedAxiosInstance.get.mockRejectedValue(axiosError);

      await expect(client.getProviderSpec('nonexistent'))
        .rejects.toThrow('Failed to get provider spec for nonexistent: Request failed');
    });
  });

  describe('executeFunction', () => {
    const mockFunctionResult: FunctionCallResult = {
      temperature: 25,
      condition: 'sunny',
      city: 'London'
    };

    it('should successfully execute function', async () => {
      mockedAxiosInstance.post.mockResolvedValueOnce({
        data: mockFunctionResult
      });

      const parameters = { city: 'London', country: 'UK' };
      const result = await client.executeFunction('getWeather', parameters);

      expect(mockedAxiosInstance.post).toHaveBeenCalledWith(
        '/execute/getWeather',
        parameters
      );
      expect(result).toEqual(mockFunctionResult);
    });

    it('should retry on failure and eventually succeed', async () => {
      mockedAxiosInstance.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: mockFunctionResult });

      const parameters = { city: 'London' };
      const result = await client.executeFunction('getWeather', parameters);

      expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockFunctionResult);
    });

    it('should throw error after max retries', async () => {
      const error = new Error('Execution failed');
      mockedAxiosInstance.post.mockRejectedValue(error);

      await expect(client.executeFunction('getWeather', { city: 'London' }))
        .rejects.toThrow('Failed to execute function getWeather after 2 attempts: Execution failed');

      expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(2); // With retryAttempts = 2
    });
  });

  describe('retry logic', () => {
    it('should wait between retries', async () => {
      const startTime = Date.now();
      mockedAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(client.getProviderSpec('test'))
        .rejects.toThrow();

      const endTime = Date.now();
      // With retryAttempts = 2:
      // - Attempt 1 fails immediately 
      // - Wait 1 second (attempt * 1000 = 1 * 1000)
      // - Attempt 2 fails
      // - No more waits since attempt 2 == retryAttempts
      // So total time should be ~1000ms, allow some variance
      expect(endTime - startTime).toBeGreaterThanOrEqual(900); // At least 900ms to account for timing variance
      expect(endTime - startTime).toBeLessThan(1500); // But less than 1500ms to ensure it's not doing extra waits
    });
  });
});
