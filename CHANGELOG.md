# Changelog

All notable changes to this project will be documented in this file.

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
4. Tag & push: `git tag v2.4.0 && git push origin v2.4.0`
5. Create GitHub Release from the tag with these notes.
