import express, { Express } from 'express';
import { AgentConfig } from '../models/types';
import { BaseCubicAgent } from './base-cubic-agent';

/**
 * Standalone CubicAgent that creates and manages its own Express server
 */
export class CubicAgent extends BaseCubicAgent {
  private app: Express;
  private server?: any;
  private port: number;

  constructor(config: AgentConfig) {
    super(config);
    
    this.port = config.port;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes(this.app);
  }

  /**
   * Start the agent server
   */
  start(callback?: () => void): void {
    this.server = this.app.listen(this.port, () => {
      this.logger.info(`CubicAgent "${this.config.agentName}" started on port ${this.port}`);
      if (callback) {
        callback();
      }
    });
  }

  /**
   * Stop the agent server
   */
  stop(): void {
    if (this.server) {
      this.server.close(() => {
        this.logger.info('CubicAgent server stopped');
      });
    }
  }

  /**
   * Get the Express app instance (useful for adding custom routes)
   */
  getApp(): Express {
    return this.app;
  }
}
