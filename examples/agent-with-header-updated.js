import { CubicAgent, CubiclerClient } from '../dist/index';

// Create Cubicler client
const cubiclerClient = new CubiclerClient('http://localhost:1503');

// Create agent - header will be automatically added to all prompts
const agent = new CubicAgent({
  port: 3000,
  agentName: 'demo-agent',
  logLevel: 'info',
  cubiclerClient: cubiclerClient
});

agent.onCall(async (request, context) => {
  const { prompt, providers, messages } = request;
  
  // The prompt now automatically includes the agent header:
  // # Note
  // You are an agent with identifier "demo-agent". When you see messages with sender "demo-agent", 
  // those are your own previous responses. When you see sender "user", those are human user messages. 
  // Any other sender names represent other agents or custom entities.
  //
  // [Original prompt follows here...]
  
  console.log('Enhanced prompt received:');
  console.log('------------------------');
  console.log(prompt);
  console.log('------------------------');
  
  // Check if this is a conversation where the agent has spoken before
  const myPreviousMessages = messages.filter(msg => msg.sender === 'demo-agent');
  const userMessages = messages.filter(msg => msg.sender === 'user');
  const otherAgentMessages = messages.filter(msg => msg.sender !== 'user' && msg.sender !== 'demo-agent');
  
  if (myPreviousMessages.length > 0) {
    console.log(`I've already responded ${myPreviousMessages.length} times in this conversation`);
    console.log('My last response was:', myPreviousMessages[myPreviousMessages.length - 1].content);
  }
  
  console.log(`User has sent ${userMessages.length} messages`);
  
  if (otherAgentMessages.length > 0) {
    const otherSenders = [...new Set(otherAgentMessages.map(msg => msg.sender))];
    console.log(`Other agents/entities in conversation: ${otherSenders.join(', ')}`);
  }
  
  let response = `Hello! I'm demo-agent and I can see I've responded ${myPreviousMessages.length} times before.`;
  
  if (userMessages.length > 0) {
    response += ` The latest user message was: "${userMessages[userMessages.length - 1].content}"`;
  }
  
  if (otherAgentMessages.length > 0) {
    const otherSenders = [...new Set(otherAgentMessages.map(msg => msg.sender))];
    response += ` I also see messages from other agents/entities: ${otherSenders.join(', ')}.`;
  }
  
  return response;
});

// Start the agent
agent.start(() => {
  console.log('Demo Agent with automatic header is running on port 3000');
  console.log('');
  console.log('Try sending a POST request to http://localhost:3000/call with:');
  console.log('Single user conversation:');
  console.log(JSON.stringify({
    prompt: 'Please introduce yourself',
    providers: [],
    messages: [
      { sender: 'user', content: 'Hello there!' }
    ]
  }, null, 2));
  console.log('');
  console.log('Multi-agent conversation:');
  console.log(JSON.stringify({
    prompt: 'Continue the conversation',
    providers: [],
    messages: [
      { sender: 'user', content: 'Hello there!' },
      { sender: 'demo-agent', content: 'Hi! I\'m demo-agent.' },
      { sender: 'weather-bot', content: 'And I\'m weather-bot, nice to meet you!' },
      { sender: 'user', content: 'Can you both tell me more about yourselves?' }
    ]
  }, null, 2));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down demo agent...');
  agent.stop();
  process.exit(0);
});
