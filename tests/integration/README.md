# Integration Tests

This directory contains all integration test resources for CubicAgentKit against real Cubicler instances.

## 📁 Directory Structure

```
tests/integration/
├── README.md                           # This file
├── docker-compose.test.yml             # Docker Compose for test environment
├── vitest.integration.config.ts        # Vitest configuration for integration tests
├── global-setup.ts                     # Global test setup (Docker lifecycle)
├── setup.ts                           # Per-test setup
├── run-integration-tests.sh           # Standalone test runner script
├── axios-agent-client.integration.test.ts    # AxiosAgentClient tests
├── cubic-agent.integration.test.ts           # CubicAgent tests
├── config/                             # Cubicler configuration files
│   ├── test-agents.json               # Test agent configuration
│   └── test-providers.json            # Test provider configuration  
└── fixtures/                          # Test fixtures
    └── test-mcp-server/               # Mock MCP server for testing
        ├── package.json
        └── index.js
```

## 🚀 Running Integration Tests

### Quick Start

```bash
# From project root - run all integration tests
npm run test:integration:run

# Run integration tests in watch mode
npm run test:integration

# Run both unit and integration tests
npm run test:all
```

### Manual Control

```bash
# Use the dedicated script for more control
cd tests/integration
./run-integration-tests.sh

# Or manage Docker manually
docker-compose -f docker-compose.test.yml up -d
npm run test:integration:run
docker-compose -f docker-compose.test.yml down -v
```

## 🧪 What's Being Tested

### AxiosAgentClient Integration

- ✅ Connection to real Cubicler instance
- ✅ MCP protocol communication  
- ✅ Tool calling with response parsing
- ✅ Error handling scenarios
- ✅ Middleware functionality

### CubicAgent Integration  

- ✅ Full agent lifecycle (start/stop)
- ✅ HTTP request handling
- ✅ Tool call tracking
- ✅ Response formatting

### Real-World Scenarios

- ✅ Docker Compose environment
- ✅ Cubicler 2.2.0 compatibility
- ✅ MCP server integration
- ✅ Network communication

## ⚙️ Configuration

### Environment Variables

- `CUBICLER_URL`: Cubicler instance URL (default: <http://localhost:1504>)
- `TEST_TIMEOUT`: Test timeout in milliseconds (default: 30000)

### Docker Services

- **cubicler**: Main Cubicler instance (port 1504)
- **test-mcp-server**: Mock MCP server (port 3020)

## 🐛 Troubleshooting

### Common Issues

**Services not starting:**

```bash
# Check Docker logs
docker-compose -f docker-compose.test.yml logs

# Ensure ports are free
lsof -i :1504
lsof -i :3020
```

**Tests timing out:**

```bash
# Increase timeout
export TEST_TIMEOUT=60000
npm run test:integration:run
```

**Cubicler connection issues:**

```bash
# Verify Cubicler is responding
curl http://localhost:1504/health
```

### Known Issues in Cubicler 2.2.0

- ❌ `cubicler_available_servers` returns empty despite loaded servers
- ❌ `cubicler_fetch_server_tools` reports "Server not found" for loaded servers  
- ✅ Direct MCP server tool calls work perfectly (e.g., `szwi9l5_get_time`)

## 🔧 Maintenance

### Updating Cubicler Version

1. Update `../../Cubicler` directory to desired version
2. Test integration compatibility
3. Update any configuration changes in `config/`

### Adding New Tests

1. Create new `*.integration.test.ts` files in this directory
2. Follow existing patterns for setup/teardown
3. Use real network calls and Docker services

### Modifying Test Environment

1. Update `docker-compose.test.yml` for service changes
2. Modify `config/` files for Cubicler configuration
3. Update `fixtures/` for test data changes

---

**Integration tests validate that CubicAgentKit works correctly with real Cubicler instances in containerized environments.**
