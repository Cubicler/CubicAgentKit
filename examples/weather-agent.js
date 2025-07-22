const { CubicAgent } = require('../dist/index');

// Create a simple weather agent
const agent = new CubicAgent({
  port: 3000,
  cubiclerEndpoint: 'http://localhost:1503',
  agentName: 'weather-agent',
  logLevel: 'info'
});

// Handle incoming requests from Cubicler
agent.onCall(async (request, context) => {
  const { prompt, providers, messages } = request;
  
  console.log('Received request:', {
    prompt: prompt.substring(0, 100) + '...',
    providers: providers.map(p => p.name),
    lastMessage: messages[messages.length - 1]
  });
  
  // Get the latest user message
  const userMessage = messages[messages.length - 1];
  
  if (userMessage.content.toLowerCase().includes('weather')) {
    try {
      // Get weather provider specs
      const weatherSpec = await context.getProviderSpec('weather_api');
      console.log('Weather context:', weatherSpec.context);
      console.log('Available functions:', weatherSpec.functions.map(f => f.name));
      
      // Execute weather function
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
  
  return "I'm a weather assistant. Ask me about the weather in any city!";
});

// Start the agent
agent.start(() => {
  console.log('Weather Agent is running on port 3000');
  console.log('Try sending a POST request to http://localhost:3000/call');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nShutting down gracefully...');
  agent.stop();
  process.exit(0);
});
