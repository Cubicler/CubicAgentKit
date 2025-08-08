# Fix Plan

Purpose: Reduce runtime/type issues, align server validation with trigger support, harden build/deps, document JWT limitations, and backstop with tests. This plan is broken into incremental, low‑risk steps with acceptance criteria.

## Objectives

- Stabilize ESM runtime and imports across modules.
- Support message-or-trigger requests consistently in all servers.
- Remove dependency/type mismatches and adjust bundling for native/optional deps.
- Document JWT middleware limitations and safe alternatives.
- Add targeted tests for trigger flows to prevent regressions.

## Phase 1 — ESM and Server Validation

1) Tracking client ESM imports
   - Change `src/client/tracking-agent-client.ts` to use `.js` suffixes for local imports.
   - Acceptance: `npm run build` succeeds; `npm run dev` does not error on missing module extensions.

2) SSE server EventSource import and types
   - Replace CommonJS `require('eventsource')` with dynamic ESM import.
   - Add explicit type import for `MessageEvent` from `eventsource` (or narrow custom type).
   - Acceptance: Type-check passes and SSE server compiles without ESM warnings.

3) Server request validators (message OR trigger)
   - `src/server/http-agent-server.ts`: accept requests with either `messages` array OR `trigger` object (mutually exclusive).
   - `src/server/sse-agent-server.ts`: `isValidSSEMessage` should validate `messages || trigger`.
   - `src/server/stdio-agent-server.ts`: `isValidAgentRequest` should validate `messages || trigger`.
   - Update 400 error messages to reflect the new requirement.
   - Acceptance: New unit tests for trigger-only requests pass for HTTP/SSE/STDIO servers.

4) Express listen error handling
   - `HttpAgentServer.start`: listen to `server.on('error')` for bind errors; resolve on `listening`.
   - Acceptance: Simulated port-in-use test fails fast with a clear error.

## Phase 2 — Build/Deps Hardening

5) Dependencies cleanup
   - Remove `@types/express` (Express 5 ships types).
   - Move `@types/eventsource` to devDependencies (typing only).
   - Remove `@types/better-sqlite3` (package includes types) or move to devDependencies if desired.
   - Acceptance: `npm i` and `npm run build` succeed; no duplicate type definition conflicts.

6) Bundler externals (native/optional deps)
   - In `tsup.config.ts`, add `better-sqlite3` and `eventsource` to `external` to avoid bundling.
   - Acceptance: Built output does not inline native modules; runtime can resolve them.

7) TS config hygiene (optional)
   - Consider `allowJs: false` to enforce TS-only in `src/`.
   - Acceptance: Lint/build still pass after any necessary minor fixes.

## Phase 3 — Tests and Docs

8) Trigger-path tests
   - Add unit tests covering trigger-only requests for HTTP, SSE, and STDIO servers.
   - Ensure CubicAgent routes trigger requests to `onTrigger`.
   - Acceptance: New tests pass locally and in CI; coverage for server paths increases.

9) Integration test resilience (optional)
   - Add Docker availability precheck or a skip to avoid local false failures.
   - Acceptance: Running integration tests locally without Docker shows a helpful skip or message.

10) JWT documentation

- Add docs clarifying `SimpleJWTVerifier` does not verify signatures and recommend a `jsonwebtoken`-backed verifier for production.
- Optionally provide an alternative middleware example using `jsonwebtoken`.
- Acceptance: Docs added; references included in README/security notes.

## Acceptance Criteria Summary

- Build (`npm run build`) succeeds with ESM imports resolved; SSE server compiles without require/ESM issues.
- Servers accept message-or-trigger and error messages reflect this.
- Unit tests added for trigger-only flows across HTTP/SSE/STDIO; pass reliably.
- Bundling excludes `better-sqlite3` and `eventsource`; runtime works.
- Type/dependency redundancies removed; no Express type conflicts.
- JWT limitations documented with a recommended production path.

## Suggested PR Breakdown

- PR 1: ESM fixes + server validator updates + tests.
- PR 2: Build/deps hardening (externals, types) + CI green.
- PR 3: JWT docs and optional prod verifier example.
