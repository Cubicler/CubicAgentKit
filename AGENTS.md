# Repository Guidelines

## Project Structure & Module Organization

- Source: `src/` — core modules in subfolders: `auth/`, `client/`, `core/`, `interface/`, `memory/`, `model/`, `server/`, `utils/`. Entry: `src/index.ts`.
- Tests: `tests/` — unit tests alongside domain folders; integration tests in `tests/integration/`.
- Docs: `docs/` — feature and transport guides.
- Examples: `examples/`; Build output: `dist/`; Coverage: `coverage/`.

## Build, Test, and Development Commands

- Build: `npm run build` (bundles via tsup to `dist/`).
- Dev run: `npm run dev` (executes `src/index.ts` with ts-node); watch: `npm run dev:watch`.
- Unit tests: `npm test` (watch), `npm run test:run` (once), `npm run test:ui`.
- Integration tests: `npm run test:integration`, `npm run test:integration:run`.
- All tests: `npm run test:all`.
- Lint: `npm run lint`; auto-fix: `npm run lint:fix`.
- Preflight: `npm run check` (lint + unit tests + build), `npm run check:all` (incl. integration).

## Coding Style & Naming Conventions

- Language: TypeScript (Node >= 18). Modules use ESM.
- Linting: ESLint + `typescript-eslint` (see `eslint.config.js`). Enforced: `no-var`, `prefer-const`, `eqeqeq`, `curly`, no unused vars (underscore-ignored), no `any` in `src/`.
- File names: kebab-case for files (`jwt-auth-provider.ts`); Classes/Types: PascalCase; functions/vars: camelCase.
- Indentation: 2 spaces. Avoid implicit `any`; prefer readonly and no floating promises.

## Testing Guidelines

- Framework: Vitest. Unit tests live in `tests/**/*.test.ts` (excluding `tests/integration/**`).
- Coverage: V8 provider with `text` and `html` reporters (output in `coverage/`).
- Integration setup uses `tests/integration/setup.ts` and `global-setup.ts`. Run locally with required env (see below).
- Add tests for new features/bug fixes; mirror folder structure of `src/` under `tests/`.

## Commit & Pull Request Guidelines

- Commits: use Conventional Commits (`feat:`, `fix:`, `chore:`, `ci:`). Keep subjects imperative and concise.
- PRs: include a clear description, linked issues, test coverage notes, and screenshots/logs when relevant. Ensure `npm run check` passes.

## Security & Configuration Tips

- Do not commit secrets. For integration tests, set `CUBICLER_URL` (defaults `http://localhost:1504`).
- JWT-related code lives in `src/auth/`; follow docs in `docs/JWT_AUTH.md`.
- See transport guides in `docs/` (`HTTP_AGENT.md`, `SSE_AGENT.md`, `STDIO_AGENT.md`) when adding or modifying agent endpoints.

## Agent-Specific Instructions

- Architecture: prefer composition and dependency injection; implement interfaces in `src/interface/`; avoid abstract classes.
- Error handling: surface errors to implementers; do not swallow exceptions.
- APIs: use current classes from `src/` — `HttpAgentClient`/`HttpAgentServer`, `SSEAgentServer`, `StdioAgentClient`/`StdioAgentServer`.
- Memory: follow factory-based setup in `src/memory/`; keep persistence in SQLite and short-term in LRU; add tests when changing memory behavior.
- Docs & tests: when public types or flows change, update `docs/` and mirror tests under `tests/`.

## Engineering Principles

- Architecture: contract-based, SOLID, and dependency inversion; avoid clever hacks.
- Code: TypeScript-first with explicit types; prefer small, pure functions; justify any mutation.
- Errors: never swallow; bubble via typed errors or a Result/Either style.
- Tests: TDD-leaning; propose and add unit tests first (Vitest by default).
- Docs: write short JSDoc for public functions; add an ADR note when changing architecture.
- Security: validate inputs and sanitize external data; never commit secrets.
- Git: make atomic commits with clear messages; show planned diff before writing.
