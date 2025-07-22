const { CubicAgent, CubiclerClient } = require('../dist/index');

// Create Cubicler client
const cubiclerClient = new CubiclerClient({
  endpoint: 'http://localhost:1503',
  timeout: 10000,
  retryAttempts: 3
});

// Approach 1: Traditional with config (creates own Express server)
const agent = new CubicAgent({
  port: 3000,
  agentName: 'weather-agent-standalone',
  logLevel: 'info',
  cubiclerClient: cubiclerClient
});

agent.onCall(async (request, context) => {
  const { prompt, providers, messages } = request;
  
  console.log('Standalone agent received request:', {
    prompt: prompt.substring(0, 100) + '...',
    providers: providers.map(p => p.name),
    lastMessage: messages[messages.length - 1]
  });
  
  const userMessage = messages[messages.length - 1];
  
  if (userMessage.content.toLowerCase().includes('weather')) {
    try {
      const weatherSpec = await context.getProviderSpec('weather_api');
      console.log('Weather functions:', weatherSpec.functions.map(f => f.name));
      
      const weather = await context.executeFunction('getWeather', {
        city: 'Paris',
        country: 'France'
      });
      
      return `The weather in Paris is ${weather.conditions} with a temperature of ${weather.temperature}°C.`;
      
    } catch (error) {
      console.error('Error getting weather:', error);
      return "Sorry, I couldn't get the weather information right now.";
    }
  }
  
  return "I'm a standalone weather assistant. Ask me about the weather in any city!";
});

// Start the agent with its own server
agent.start(() => {
  console.log('Standalone Weather Agent is running on port 3000');
  console.log('Health check: http://localhost:3000/health');
  console.log('Call endpoint: http://localhost:3000/call');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nShutting down standalone agent...');
  agent.stop();
  process.exit(0);
});
