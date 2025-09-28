# Repository Guidelines

## Project Structure & Module Organization
- `app/` — Next.js App Router (routes, `layout.tsx`, global styles in `app/globals.css`).
- `components/` — Shared UI. `components/ui/` contains shadcn/ui primitives; `theme-provider.tsx` wraps next-themes.
- `hooks/` — Reusable React hooks.
- `lib/` — Utilities and helpers (import via `@/lib/*`).
- `public/` — Static assets served at `/`.
- `styles/` — Additional global CSS (legacy/auxiliary).
- Config: `next.config.mjs`, `tsconfig.json` (path alias `@/*`), `postcss.config.mjs` (Tailwind v4).

## Build, Test, and Development Commands
- `npm run dev` — Start dev server at http://localhost:3000.
- `npm run build` — Production build to `.next/`.
- `npm start` — Serve the production build.
- `npm run lint` — ESLint via Next.js.
- `npm run test:unit` — Run Jest + React Testing Library.
- `npm run test:e2e` — Run Playwright E2E tests (dev server auto-starts).
- `npm run test:e2e:ui` — Playwright UI mode for debugging.
Note: `package-lock.json` is present; use npm to avoid lockfile drift. Builds currently ignore ESLint/TypeScript errors (see `next.config.mjs`) — still fix issues before opening PRs.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Prefer typed props/returns; avoid `any`.
- React: Components in PascalCase; hooks in camelCase (`useSomething`).
- Files: Next routes use `page.tsx`/`layout.tsx`. shadcn components follow kebab-case filenames in `components/ui/` (e.g., `button.tsx`).
- Styling: Tailwind CSS utility classes; colocate minimal component styles. Use `clsx`/`tailwind-merge` for variants.
- Imports: Use `@/*` alias (e.g., `@/components/ui/button`).

## Testing Guidelines
- Unit: Jest with jsdom + RTL.
  - Name files `*.test.tsx`; colocate or use `__tests__/`.
  - Example: `__tests__/button.test.tsx` renders `@/components/ui/button`.
- E2E: Playwright.
  - Specs in `e2e/`; example: `e2e/home.spec.ts` asserts the page title.
  - Local: `playwright.config.ts` auto-starts the dev server.
  - CI: runs against a production build (`next build` + `next start`).

## CI
- GitHub Actions at `.github/workflows/ci.yml` runs lint, unit tests, installs Playwright, builds the app, then runs E2E.
- Commands used:
  - `npm ci && npm run lint && npm run test:unit`
  - `npm run pw:install && npm run build && npm run test:e2e`

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits.
  - Examples: `feat: add sidebar resizable panel`, `fix: prevent tab name collision`, `chore: bump next to 14.2.x`.
- PRs should include:
  - Clear description, rationale, and screenshots for UI changes.
  - Steps to test locally and any migration notes.
  - Checklist: `npm run lint` passes, types clean locally, no console errors.

## Architecture Notes
- Next.js App Router with client-heavy UI (Monaco, themes, shadcn/ui).
- Images are `unoptimized`; keep large assets in `public/` and reference by path.
- Respect `use client` boundaries and keep pure utilities in `lib/`.
