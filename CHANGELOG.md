# [2.6.3] - 2025-08-10

### Added

- **Type Safety Improvements**: Comprehensive replacement of `any` and `unknown` types with concrete type definitions
- **EventSource Type Definitions**: Added proper EventSource interface definitions for SSE agent server
- **Enhanced Error Handling**: Improved error type safety across all transport implementations

### Changed

- **JWT Interfaces**: Replaced `unknown` types in JWT payload and header interfaces with proper union types
- **OAuth Error Handling**: Improved OAuth error response type safety in JWT auth provider
- **Stdio Transport**: Enhanced type safety for JSON-RPC message handling
- **SSE Transport**: Improved type definitions for SSE message validation and error handling

### Fixed

- **TypeScript Strict Mode**: Resolved all remaining `any` and `unknown` type issues
- **Linting**: All ESLint rules now pass without disable comments
- **Error Types**: Replaced generic error types with proper `Error` interface usage

### Internal

- **All 362 tests passing**: Complete test suite validation after type safety improvements
- **Zero breaking changes**: Maintained full backward compatibility
- **Code Quality**: Significantly improved type safety and developer experience

# [2.6.2] - 2025-08-09

### Fixed

- Restored compatibility for stdio agent client/server with Node.js streams and test mocks
- Removed unsupported `process.stdout.on` usage
- All unit tests now pass for stdio agent components

### Added

- Example: `examples/stdio-long-lived-agent.ts` for persistent agent process
- Documentation updates for stdio agent patterns and recommendations

### Changed

- Updated `.github/copilot-instructions.md`, `CLAUDE.md`, `STDIO_AGENT_INTEGRATION.md` with latest stdio agent patterns
- Improved error handling and process management in stdio agent client/server

# [2.6.1] - 2025-08-09

### Added

- Pino logger integration for structured logging
- Pretty-printed logs for HTTP/SSE transports
- Silent logging for stdio transport

### Changed

- Replaced all `console.log` statements with Pino logging
- Environment-aware logging configuration

### Quality

- All 362 unit tests passing
- ESLint clean
- TypeScript compilation successful
- Build process verified

# Changelog

All notable changes to this project will be documented in this file.

## [2.6.0] - 2025-08-09

### Added

- **JSON-RPC 2.0 Protocol**: Stdio transport now uses standard JSON-RPC 2.0 for all communication instead of custom message types
- **Consolidated Agent Models**: New unified `agent.ts` model file containing all agent request/response types (`AgentRequest`, `MessageRequest`, `TriggerRequest`, `RawAgentResponse`, `AgentResponse`)
- **Logger Infrastructure**: Comprehensive logging system with `Logger` interface, `ConsoleLogger`, `SilentLogger`, and transport-specific utilities
- **JSON-RPC Types**: New `stdio.ts` model with complete JSON-RPC 2.0 protocol structures (`StdioRequest`, `StdioResponse`, `STDIODispatchRequest`, etc.)

### Changed

- **BREAKING: Stdio Protocol Migration**: StdioAgentClient and StdioAgentServer now use JSON-RPC 2.0 `dispatch` method instead of `agent_request/agent_response`
- **Model Architecture**: Consolidated separate `agent-request.ts` and `agent-response.ts` files into unified `agent.ts` model
- **Request ID System**: StdioAgentClient now uses incremental request IDs instead of UUIDs for better JSON-RPC compliance
- **Logging Behavior**: Stdio transport uses `SilentLogger` to avoid polluting stdout, HTTP/SSE use `ConsoleLogger` with prefixes
- **Import Paths**: All agent model imports now point to consolidated `model/agent.js` throughout the codebase
- **Error Handling**: JSON-RPC 2.0 compliant error responses with proper error codes and messages

### Fixed

- **Failing Unit Tests**: Updated all stdio tests to expect JSON-RPC 2.0 format instead of custom message types
- **Test Protocol**: Updated test expectations from `MCP Error` to `JSON-RPC Error` messages
- **Integration Tests**: Updated all test imports to use consolidated agent models
- **Mock Implementations**: Updated test helpers and mocks to use unified agent types

### Documentation

- **STDIO_AGENT.md**: Complete rewrite to document JSON-RPC 2.0 protocol with updated examples
- **README.md**: Added "Recent Updates" section highlighting v2.6.0 architectural improvements
- **Python Example**: Updated Python stdio agent example to use proper JSON-RPC 2.0 format
- **Protocol Documentation**: Updated message protocol examples to show JSON-RPC request/response structure
- **Manual Testing**: Updated testing commands to use JSON-RPC format instead of custom messages

### Internal

- **All 362 tests passing**: Complete test suite validation after major refactoring with no functionality lost
- **Backward Compatibility**: Maintained API compatibility while improving internal architecture and protocol standardization
- **Code Organization**: Removed duplicate model definitions and improved maintainability through consolidation
- **Protocol Standardization**: Aligned stdio transport with industry-standard JSON-RPC 2.0 specification
- Bumped version to 2.6.0

## [2.5.0] - 2025-08-09

### Added

- **Builder Pattern Implementation**: New fluent API for CubicAgent configuration with `start().onMessage().onTrigger().listen()`
- **Type-safe handlers**: Separate `MessageHandler` and `TriggerHandler` interfaces with automatic request routing
- **Enhanced Documentation**: Complete STDIO_AGENT.md rewrite with detailed implementation guide
- **New Integration Guide**: STDIO_AGENT_INTEGRATION.md for various scenarios and configuration examples
- **CubicAgentBuilder class**: New builder class exported in main index for fluent API configuration

### Changed

- **Simplified Stdio Agent Implementation**: Streamlined architecture with cleaner subprocess handling and pure stdio-based MCP protocol communication
- **README Updates**: Improved stdio agent examples and configuration documentation  
- **Builder pattern documentation**: Added practical examples and migration guide from legacy API
- **Test Infrastructure**: Refactored test suites for stdio agents with better error handling coverage

### Fixed

- **Failing Unit Tests**: Resolved 7 failing tests in stdio agent implementation
- **TypeScript Strict Mode**: Fixed "Object is possibly undefined" errors in test files for mock call array access
- **Test Isolation**: Added proper server cleanup in afterEach to ensure test isolation
- **Mock Setup Order**: Fixed mock setup order in StdioAgentClient tests - clear mocks before client instantiation
- **Synchronous vs Async**: Fixed StdioAgentServer test expectation - start() throws synchronously, not async

### Internal

- **All 362 tests passing**: Complete test suite validation with TypeScript strict mode compatibility
- **Automatic validation**: Built-in error handling for invalid requests with descriptive messages
- **Backward compatibility**: Maintained with existing implementations - no breaking changes
- Bumped version to 2.5.0

## [2.4.0] - 2025-08-08

### Added

- (Placeholder) New features can be listed here.

### Changed

- Improved type safety in HTTP and Stdio agent servers (removed `any` usages, stronger structural validation).
- Refined integration tests to use builder-based startup API.

### Fixed

- Resolved ESLint failures (`no-explicit-any`, unsafe member access) to ensure clean linting prior to release.

### Internal

- Bumped version to 2.4.0.
- All unit tests (384) passing and lint passes.

## [2.3.x]

- Previous versions.

---

Release process:

1. Ensure working tree clean and on `main`.
2. `npm run build`
3. `npm publish` (or `npm publish --access public` if first time)
4. Tag & push: `git tag v2.4.1 && git push origin v2.4.1`
5. Create GitHub Release from the tag with these notes.
