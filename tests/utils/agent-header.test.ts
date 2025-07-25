import { generateAgentHeader, prependAgentHeader } from '../../src/utils/agent-header';

describe('Agent Header Utils', () => {
  describe('generateAgentHeader', () => {
    it('should generate a proper agent identity header', () => {
      const agentName = 'test-agent';
      const header = generateAgentHeader(agentName);
      
      expect(header).toContain('# Note');
      expect(header).toContain(`You are an agent with identifier "${agentName}"`);
      expect(header).toContain(`sender "${agentName}"`);
      expect(header).toContain('sender "user"');
      expect(header).toContain('other agents or custom entities');
      expect(header.endsWith('\n\n')).toBe(true);
    });

    it('should handle different agent names', () => {
      const agentName = 'weather-assistant';
      const header = generateAgentHeader(agentName);
      
      expect(header).toContain(`identifier "${agentName}"`);
      expect(header).toContain(`sender "${agentName}"`);
    });

    it('should have consistent format', () => {
      const header = generateAgentHeader('my-agent');
      const lines = header.split('\n');
      
      expect(lines[0]).toBe('# Note');
      expect(lines[1]).toMatch(/^You are an agent with identifier/);
      expect(lines[2]).toBe('');
      expect(lines[3]).toBe('');
    });
  });

  describe('prependAgentHeader', () => {
    it('should prepend header to original prompt', () => {
      const agentName = 'test-agent';
      const originalPrompt = 'Answer the user\'s question about weather.';
      
      const result = prependAgentHeader(agentName, originalPrompt);
      
      expect(result).toContain('# Note');
      expect(result).toContain(`identifier "${agentName}"`);
      expect(result).toContain(originalPrompt);
      expect(result.indexOf('# Note')).toBe(0);
      expect(result.indexOf(originalPrompt)).toBeGreaterThan(0);
    });

    it('should preserve original prompt content exactly', () => {
      const agentName = 'assistant';
      const originalPrompt = `Complex prompt with:
- Multiple lines
- Special characters: !@#$%
- Unicode: 🌟✨
- Formatting`;
      
      const result = prependAgentHeader(agentName, originalPrompt);
      
      expect(result).toContain(originalPrompt);
      expect(result.endsWith(originalPrompt)).toBe(true);
    });

    it('should work with empty prompt', () => {
      const agentName = 'empty-test';
      const originalPrompt = '';
      
      const result = prependAgentHeader(agentName, originalPrompt);
      
      expect(result).toContain('# Note');
      expect(result).toContain(`identifier "${agentName}"`);
      expect(result.endsWith('')).toBe(true);
    });
  });
});
