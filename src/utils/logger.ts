import pino from 'pino';

/**
 * Create a logger for STDIO transport
 * Uses silent level to avoid polluting stdout
 */
export function createStdioLogger(): pino.Logger {
  return pino({
    level: 'silent' // Completely silent for stdio transport
  });
}

/**
 * Create a logger for HTTP/SSE transports
 * Uses Pino logger with appropriate configuration
 */
export function createHttpLogger(name: string = 'CubicAgentKit'): pino.Logger {
  // Check if we're in test environment
  if (process.env.NODE_ENV === 'test') {
    return pino({
      name,
      level: process.env.LOG_LEVEL || 'silent' // Silent in tests unless LOG_LEVEL is set
    });
  }

  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  });
}

/**
 * Create a logger based on transport type
 */
export function createLogger(transport: 'stdio' | 'http' | 'sse', name?: string): pino.Logger {
  switch (transport) {
    case 'stdio':
      return createStdioLogger();
    case 'http':
    case 'sse':
      return createHttpLogger(name);
    default:
      return createHttpLogger(name);
  }
}