const express = require('express');
const { CubicAgentExpress, CubiclerClient } = require('../dist/index');

// Create your own Express app
const app = express();
const port = 3001;

// Add your own middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Add custom routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Custom Express app with integrated CubicAgent',
    endpoints: {
      health: '/health',
      call: '/call',
      custom: '/api/status'
    }
  });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'Custom endpoint working',
    agent: 'weather-agent-integrated',
    uptime: process.uptime()
  });
});

// Create Cubicler client
const cubiclerClient = new CubiclerClient({
  endpoint: 'http://localhost:1503',
  timeout: 10000,
  retryAttempts: 3
});

// Approach 2: Inject Express app into CubicAgentExpress
const agent = new CubicAgentExpress(app, {
  agentName: 'weather-agent-integrated',
  logLevel: 'info',
  cubiclerClient: cubiclerClient
});

agent.onCall(async (request, context) => {
  const { prompt, providers, messages } = request;
  
  console.log('Integrated agent received request:', {
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
        city: 'London',
        country: 'UK'
      });
      
      return `The weather in London is ${weather.conditions} with a temperature of ${weather.temperature}°C.`;
      
    } catch (error) {
      console.error('Error getting weather:', error);
      return "Sorry, I couldn't get the weather information right now.";
    }
  }
  
  return "I'm an integrated weather assistant running alongside custom routes!";
});

// You start your own server
app.listen(port, () => {
  console.log(`Integrated Express app with CubicAgent running on port ${port}`);
  console.log('Custom routes:');
  console.log(`  Root: http://localhost:${port}/`);
  console.log(`  Status: http://localhost:${port}/api/status`);
  console.log('CubicAgent routes:');
  console.log(`  Health: http://localhost:${port}/health`);
  console.log(`  Call: http://localhost:${port}/call`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nShutting down integrated app...');
  process.exit(0);
});
