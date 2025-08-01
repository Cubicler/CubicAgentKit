const express = require('express');
const app = express();

app.use(express.json());

// Mock MCP server endpoints
app.post('/mcp', (req, res) => {
  const { method, params, id } = req.body;
  
  switch (method) {
    case 'initialize':
      res.json({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'test-mcp-server',
            version: '1.0.0'
          }
        },
        id
      });
      break;
      
    case 'tools/list':
      res.json({
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'get_time',
              description: 'Get current time',
              inputSchema: {
                type: 'object',
                properties: {},
                required: []
              }
            },
            {
              name: 'echo',
              description: 'Echo back the input',
              inputSchema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    description: 'Message to echo'
                  }
                },
                required: ['message']
              }
            }
          ]
        },
        id
      });
      break;
      
    case 'tools/call':
      const { name, arguments: args } = params;
      
      if (name === 'get_time') {
        res.json({
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: new Date().toISOString()
              }
            ]
          },
          id
        });
      } else if (name === 'echo') {
        res.json({
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: `Echo: ${args.message}`
              }
            ]
          },
          id
        });
      } else {
        res.json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Unknown tool: ${name}`
          },
          id
        });
      }
      break;
      
    default:
      res.json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Unknown method: ${method}`
        },
        id
      });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Test MCP server running on port ${PORT}`);
});
