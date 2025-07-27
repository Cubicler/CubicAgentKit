import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '../../src/utils/logger';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with default info level', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with specified level', () => {
      const logger = new Logger('debug');
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      const logger = new Logger('debug');
      logger.debug('test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[DEBUG\] test message/)
      );
    });

    it('should log info messages when level is info or lower', () => {
      const logger = new Logger('info');
      logger.info('test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[INFO\] test message/)
      );
    });

    it('should log warn messages when level is warn or lower', () => {
      const logger = new Logger('warn');
      logger.warn('test message');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] test message/)
      );
    });

    it('should log error messages when level is error or lower', () => {
      const logger = new Logger('error');
      logger.error('test message');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[ERROR\] test message/)
      );
    });

    it('should not log debug when level is info', () => {
      const logger = new Logger('info');
      logger.debug('test message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log info when level is warn', () => {
      const logger = new Logger('warn');
      logger.info('test message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log with data', () => {
    it('should log message with additional data object', () => {
      const logger = new Logger('info');
      const testData = { key: 'value', number: 123 };
      logger.info('test message', testData);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[INFO\] test message {"key":"value","number":123}/)
      );
    });
  });

  describe('timestamp format', () => {
    it('should include ISO timestamp in log messages', () => {
      const logger = new Logger('info');
      logger.info('test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
      );
    });
  });
});
