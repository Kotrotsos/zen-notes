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

## Project Memory (Agent Notes)
- AI Workbench now supports two modes:
  - **Basic Mode**: original chunking UI (prompt/template selector, model, advanced settings) feeding the standard `/api/ai-workbench` SSE pipeline. Chunking controls (CSV detection, row limit, separators) live above the mode toggle and apply globally.
  - **Advanced Mode**: YAML-defined workflow runner with nodes `func`, `prompt`, and `print`. Each chunk/row flows sequentially through nodes and the final context (including `chunk`, `row`, and node outputs) is captured in the results pane. `func` nodes execute JS, can merge data or return `{ skip: true }`. `prompt` nodes call OpenAI with optional system prompt, template interpolation, and JSON parsing support. `print` nodes append to workflow logs.
- Workbench UI uses a shared vertical splitter; advanced mode results/logs occupy the lower pane, while the YAML editor occupies the upper pane. Both panes are resizable like basic mode.
- Activity spinner in status bar shows playful verbs (rotating list) and integrates with long-running actions: file uploads, table view initialization, basic chunk processing, advanced workflow runs, and bulk merge/apply actions (`runWithActivity` helper in `app/page.tsx`).
- Advanced workflow default system prompt follows prompt-engineering best practices but can be overridden per prompt node. Templates use `{{ key }}` with dot-path support.
- Workflow results table now stores `chunk` alongside context to preserve chunking parity with basic mode; chunking logic (CSV parsing, separators, row limits) is memoized and shared.
- API (`app/api/ai-workbench/route.ts`) accepts optional `system` text and only appends chunk content when requested via `includeChunk` to avoid redundant chat turns when using CSV variables.
- Icons in Explorer/Favorites/@ reference: prompts use sparkles, `.csv`/table view uses table glyph, active tabs get a blue underline.
- Deleting files/folders prompts a shadcn Dialog confirmation with "Always delete right away" option (persisted in settings). Closing a tab merely hides it (`tab.isOpen`), preserving Explorer entries.
- Spinner text fun-word list stored in `app/page.tsx`; tweak there to adjust flavor.
- Workflow Cookbook: Advanced mode now includes a comprehensive workflow management system:
  - **Built-in Examples**: 11 example workflows (4 beginner, 4 intermediate, 3 advanced) shipped in `/public/workflows/` organized by difficulty.
  - **Categories**: Content Generation, Data Processing, Analysis, Multi-step Workflows.
  - **Workflow Files**: Stored as `.workflow` files with YAML frontmatter (name, category, difficulty, tags, description, use_cases) + workflow body.
  - **UI Components**: `WorkflowDropdown` for quick access (favorites, recent, grouped by category), `WorkflowBrowser` modal for detailed browsing with filters and code preview.
  - **Management**: Full CRUD - load built-in/custom workflows, save custom workflows to workspace, favorite tracking, recent tracking (localStorage).
  - **Unsaved Changes**: Smart tracking with warnings before loading new workflow.
  - **Integration**: Follows prompt system pattern - parent (`app/page.tsx`) handles file I/O, `AIWorkbench` handles UI/state.
  - **Utilities**: `lib/workflow-service.ts` (parsing, building, loading), `lib/workflow-types.ts` (TypeScript types).
