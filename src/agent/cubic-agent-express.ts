import { Express } from 'express';
import { CubicAgentOptions } from '../models/types';
import { BaseCubicAgent } from './base-cubic-agent';

/**
 * CubicAgent wrapper for existing Express applications
 */
export class CubicAgentExpress extends BaseCubicAgent {
  private app: Express;

  constructor(app: Express, options: CubicAgentOptions) {
    super(options);
    
    this.app = app;
    this.setupRoutes(this.app);
  }

  /**
   * Get the Express app instance
   */
  getApp(): Express {
    return this.app;
  }
}
