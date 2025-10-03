# Zen Notes

A Next.js 14 (App Router) app using Tailwind v4 and shadcn/ui.

## Development

- Install: `npm ci`
- Dev server: `npm run dev` (http://localhost:3000)
- Lint: `npm run lint`
- Unit tests: `npm run test:unit`
- E2E tests: `npm run test:e2e`

## Build & Run (local prod)

- Build: `npm run build`
- Start: `npm start`

Notes:
- The build uses Next.js standalone output. `npm start` runs `node server.js` from `.next/standalone`.

## Deploy: Railway

Railway auto-detects Node apps. This project is configured to run a standalone Next.js server and includes a `Procfile`.

1) Create service
- In Railway, create a new project and select “Deploy from GitHub”
- Connect this repository

2) Build and start commands (defaults are fine)
- Install: `npm ci`
- Build: `npm run build`
- Start: `npm start`

3) Environment variables
- Add any required secrets (e.g., `OPENAI_API_KEY`).

4) Deploy
- Push to the default branch; Railway will build and deploy automatically.

5) Verify
- Open the deployment URL and tail logs in Railway if needed.

## Configuration

- `next.config.mjs` sets `output: 'standalone'` so the runtime doesn’t need the Next CLI.
- `Procfile` sets: `web: npm run start`.
- `package.json` scripts:
  - `build`: `next build`
  - `postbuild`: copies `.next/static` and `public` into `.next/standalone`
  - `start`: `cd .next/standalone && node server.js`
- `engines` declares Node and npm versions so Railway selects a compatible runtime.

## Environment

Common variables you might set in Railway:
- `OPENAI_API_KEY`: API key for OpenAI features
- Any app-specific flags/secrets

## Troubleshooting

- If assets 404 in production, ensure `postbuild` ran and the `.next/static` folder exists inside `.next/standalone/.next/static`.
- Make sure you’re on Node 18–22 (see `package.json` `engines`).
