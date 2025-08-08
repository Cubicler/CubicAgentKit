# Changelog

All notable changes to this project will be documented in this file.

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
