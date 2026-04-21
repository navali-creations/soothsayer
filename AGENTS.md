# Repository Guidelines

## Project Structure & Module Organization

Soothsayer is a TypeScript Electron app for Path of Exile divination card tracking. Main-process code lives in `main/`, with feature modules under `main/modules/` and tests in colocated `__tests__/` folders. Renderer code lives in `renderer/`, with React routes in `renderer/routes/`, UI modules in `renderer/modules/`, shared components in `renderer/components/`, hooks in `renderer/hooks/`, and static assets in `renderer/assets/`. End-to-end tests and helpers are in `e2e/`. Supabase migrations, edge functions, seeds, and database tests are in `supabase/`. Shared project types and enums are in `types/` and `enums/`.

## Build, Test, and Development Commands

Use `pnpm` with Node `>=24` and pnpm `>=10`.

- `pnpm dev`: starts local Supabase, then launches Electron Forge.
- `pnpm start`: launches the Electron app without starting Supabase.
- `pnpm typecheck`: runs `tsc --noEmit`.
- `pnpm check`: runs Biome formatting and lint checks.
- `pnpm check:fix`: applies Biome fixes and import organization.
- `pnpm test`: runs main and renderer Vitest suites.
- `pnpm test:e2e`: rebuilds Electron native dependencies, then runs Playwright.
- `pnpm test:all`: runs unit, Supabase, edge-function, and e2e tests.
- `pnpm make`: builds distributable Electron packages.

## Coding Style & Naming Conventions

Biome is the source of truth for formatting and linting. Use 2-space indentation and double quotes in JavaScript/TypeScript. Keep imports organized by the configured groups: Node, packages, `~/main`, `~/renderer`, shared `~/types`/`~/enums`, then local imports. Match existing file naming by feature, for example `Storage.service.ts`, `Storage.slice.ts`, `Cards.page.tsx`, and `*.test.ts(x)`.

## Testing Guidelines

Vitest covers main and renderer code through `vitest.main.config.mts` and `vitest.renderer.config.mts`. Prefer colocated tests beside the implementation: `main/modules/foo/__tests__/Foo.service.test.ts` or `renderer/modules/foo/Foo.slice/Foo.slice.test.ts`. Use Playwright specs under `e2e/flows/` for app-level behavior and helpers from `e2e/helpers/`. Supabase database tests use `supabase/tests/database/*.test.sql`; edge-function tests live in `supabase/functions/tests/`.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat:`, `chore:`, and `chore(deps-dev):`; follow that style with concise, imperative summaries. Pull requests should describe the behavioral change, list verification commands run, link related issues when applicable, and include screenshots or recordings for visible UI changes.

## Security & Configuration Tips

Start from `.env.example` and keep local secrets in `.env`. Do not commit generated outputs such as `dist/`, `out/`, coverage reports, Playwright reports, or local Supabase state. When changing Electron, IPC, auth, logging, or Supabase policies, run the narrow tests plus `pnpm typecheck` and `pnpm check`.
