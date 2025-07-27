import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { ProviderSpecResponse, FunctionCallResult, JSONObject, ICubiclerClient } from '../models/types.js';

export class CubiclerClient implements ICubiclerClient {
  private client: AxiosInstance;
  private timeout: number;
  private retryAttempts: number;

  constructor(
    cubiclerEndpoint: string,
    timeout: number = 30000,
    retryAttempts: number = 3
  ) {
    this.timeout = timeout;
    this.retryAttempts = retryAttempts;

    this.client = axios.create({
      baseURL: cubiclerEndpoint,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get provider specification and context from Cubicler
   */
  async getProviderSpec(providerName: string): Promise<ProviderSpecResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.get(`/provider/${providerName}/spec`);
        return response.data;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryAttempts) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    throw new Error(`Failed to get provider spec for ${providerName}: ${lastError!.message}`);
  }

  /**
   * Execute a function through Cubicler
   */
  async executeFunction(functionName: string, parameters: JSONObject): Promise<FunctionCallResult> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.post(`/execute/${functionName}`, parameters);
        return response.data;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryAttempts) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    throw new Error(`Failed to execute function ${functionName} after ${this.retryAttempts} attempts: ${lastError!.message}`);
  }
}
