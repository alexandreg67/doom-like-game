# Repository Guidelines

## Project Structure & Module Organization
- apps/web: Vite app that runs the game locally and in production.
- packages/engine: Babylon.js-based rendering and platform glue.
- packages/game-logic: ECS, rules, and simulation code.
- packages/map-editor: Web level editor components.
- packages/assets: Asset pipeline and WAD-like format helpers.
- packages/weapons: Weapon system and aiming mechanics.
- docs: Architecture notes and feature specs.
- tests: Playwright E2E at `tests/e2e`, shared test setup at `tests/setup.ts`.

## Build, Test, and Development Commands
- `pnpm install`: Install workspace dependencies.
- `pnpm dev`: Start the web app (apps/web) with hot reload.
- `pnpm build`: Build engine, game-logic, and web bundles.
- `pnpm -r test`: Run unit tests across all packages (Vitest).
- `pnpm test:e2e`: Run Playwright tests (spins up dev server automatically).
- `pnpm lint` / `pnpm format`: Lint/format via Biome across the monorepo.
- `pnpm typecheck`: TypeScript checks (no emit).
- `pnpm clean`: Remove build artifacts.

Tip: apps/web syncs engine fixtures via `npm run sync-fixtures` during `dev/build`.

## Coding Style & Naming Conventions
- Language: TypeScript, ES modules. Node 20+, pnpm 9+.
- Formatting: Biome (2-space indent, 100-char line width, single quotes, semicolons, ES5 trailing commas).
- Naming: `PascalCase` classes, `camelCase` functions/vars, `SCREAMING_SNAKE_CASE` constants.
- Packages are scoped `@doom-like/*`; prefer colocated `src/*` with clear module boundaries.

## Testing Guidelines
- Unit: Vitest with `jsdom`; place tests near code or in `__tests__`, name `*.test.ts`.
- Coverage: Root Vitest config enforces ~70% global thresholds.
- E2E: Playwright specs in `tests/e2e/*.spec.ts`; base URL `http://localhost:5173` via web server.
- Mocks: See `tests/setup.ts` for WebGPU/WebGL/Audio mocks.

## Commit & Pull Request Guidelines
- Branching: Use feature branches (`feature/…`, `fix/…`). Push to `main` is blocked by lefthook.
- Commits: Prefer Conventional Commits (`feat:`, `fix:`, `chore:`). Keep messages imperative and scoped.
- Before PR: `pnpm format && pnpm lint && pnpm typecheck && pnpm -r test` (and `pnpm test:e2e` when UI changes).
- PRs: Include summary, rationale, linked issues, screenshots or clips for visual changes, and notes on testing.

## Security & Configuration Tips
- Environment vars: use Vite `VITE_*` (e.g., `VITE_WEBGPU_ENABLED`).
- WebGPU: production requires HTTPS and COOP/COEP headers; see README deployment notes.
- Assets: keep large binaries in `packages/assets` and reference via the asset pipeline.
