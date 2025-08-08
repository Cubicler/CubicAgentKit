/**
 * Logger interface for CubicAgentKit
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  private readonly enabled: boolean;
  private readonly prefix: string;

  constructor(enabled: boolean = true, prefix: string = '') {
    this.enabled = enabled;
    this.prefix = prefix;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  private formatMessage(message: string): string {
    return this.prefix ? `${this.prefix} ${message}` : message;
  }
}

/**
 * Silent logger that outputs nothing
 */
export class SilentLogger implements Logger {
  debug(): void {
    // Silent
  }

  info(): void {
    // Silent
  }

  warn(): void {
    // Silent
  }

  error(message: string, ...args: unknown[]): void {
    // Output errors to stderr even in silent mode for debugging
    console.error(message, ...args);
  }
}

/**
 * Create a logger for STDIO transport
 * Uses SilentLogger to avoid polluting stdout
 */
export function createStdioLogger(): Logger {
  return new SilentLogger();
}

/**
 * Create a logger for HTTP/SSE transports
 * Uses ConsoleLogger with appropriate prefix
 */
export function createHttpLogger(prefix: string = '[CubicAgentKit]'): Logger {
  return new ConsoleLogger(true, prefix);
}

/**
 * Create a logger based on transport type
 */
export function createLogger(transport: 'stdio' | 'http' | 'sse', prefix?: string): Logger {
  switch (transport) {
    case 'stdio':
      return createStdioLogger();
    case 'http':
    case 'sse':
      return createHttpLogger(prefix);
    default:
      return new ConsoleLogger(true, prefix);
  }
}
