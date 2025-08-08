# Tasks Checklist

Track progress by checking off items. Each task lists key files to touch and a quick validation.

## Phase 1 — ESM + Validation

- [ ] Fix ESM imports
  - Files: `src/client/tracking-agent-client.ts`
  - Action: Add `.js` suffix for `../interface/agent-client` and `../model/types` imports.
  - Validate: `npm run build`, `npm run dev` (no module resolution errors).

- [ ] SSE EventSource import and types
  - Files: `src/server/sse-agent-server.ts`
  - Action: Replace `require('eventsource')` with dynamic `import('eventsource')` and import `MessageEvent` type (or define minimal interface).
  - Validate: `npm run build` passes; no ESM warnings.

- [ ] HTTP server validation (messages OR trigger)
  - Files: `src/server/http-agent-server.ts`
  - Action: Accept requests with `messages` or `trigger`; update error texts.
  - Validate: New unit tests for trigger-only requests pass.

- [ ] SSE/STDIO validators (messages OR trigger)
  - Files: `src/server/sse-agent-server.ts`, `src/server/stdio-agent-server.ts`
  - Action: Adjust validators to allow `trigger` path.
  - Validate: New unit tests pass.

- [ ] Express listen error handling
  - Files: `src/server/http-agent-server.ts`
  - Action: Use `server.on('listening')` and `server.on('error', reject)`.
  - Validate: Simulated port collision test fails fast.

## Phase 2 — Build/Deps

- [ ] Remove/adjust types
  - Files: `package.json`
  - Action: Remove `@types/express`; move `@types/eventsource` to devDeps; remove or move `@types/better-sqlite3` to devDeps.
  - Validate: `npm i && npm run build` clean; no duplicate types.

- [ ] Externalize native/optional deps
  - Files: `tsup.config.ts`
  - Action: Add `better-sqlite3`, `eventsource` to `external`.
  - Validate: Output doesn’t inline native modules; runtime works.

- [ ] TS config hygiene (optional)
  - Files: `tsconfig.json`
  - Action: Consider `allowJs: false`.
  - Validate: Lint/build pass.

## Phase 3 — Tests/Docs

- [ ] Add trigger-only tests
  - Files: `tests/server/*.test.ts`, `tests/core/*.test.ts`
  - Action: Add cases for trigger-only across HTTP/SSE/STDIO; verify CubicAgent routes to `onTrigger`.
  - Validate: `npm run test:run` green; coverage rises on new paths.

- [ ] Integration precheck (optional)
  - Files: `tests/integration/setup.ts`
  - Action: Add Docker availability check or skip logic.
  - Validate: Clear message when Docker isn’t available; CI still runs.

- [ ] JWT docs
  - Files: `README.md` (link), new doc (e.g., `docs/JWT-PRODUCTION.md`)
  - Action: Document signature verification gap; show `jsonwebtoken` middleware example.
  - Validate: Docs render; linked from README.

## Commands

- Build: `npm run build`
- Unit tests: `npm run test:run`
- Lint: `npm run lint`
- All tests: `npm run test:all`
