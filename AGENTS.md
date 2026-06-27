# AGENTS.md

## Cursor Cloud specific instructions

### Product
This repo is **SNIPER BO IA**, a Portuguese-language SaaS dashboard for live Bac Bo analysis. The primary product is the React 19 + TanStack Start web app at the repo root, served together with its integrated Cloudflare Worker/Nitro server (`src/server.ts`). `backend/` is an **optional** isolated FastAPI billing microservice.

### Package manager: Bun (not npm)
The only committed lockfile is `bun.lock` (+ `bunfig.toml`), so use **Bun** even though `package.json` `packageManager` says npm. The update script runs `bun install` (Bun is symlinked into `/usr/local/bin`). Scripts: `bun run dev`, `bun run build`, `bun run lint`, `bun run format`.

### Running the web app (main product)
- `bun run dev` starts Vite at `http://127.0.0.1:5175/` (`strictPort`). The same process serves the API routes (`/health`, `/dashboard`, `/auth/*`, billing webhooks, etc.).
- Non-obvious: **auth endpoints require `SNIPER_SESSION_SECRET` to be set in the dev server's environment.** Without it, `/auth/register` and `/auth/check` return `503 "Sessao nao configurada no servidor."` and you cannot log in or reach `/app`. Export any non-empty value before running dev, e.g. `export SNIPER_SESSION_SECRET=dev-local-secret-xxxxxxxxxxxx` then `bun run dev`.
- A fresh registration grants a time-limited **demo/trial** that opens the `/app` dashboard. The dashboard renders mock/demo data when no live signals collector is connected (the live Bac Bo collector is an external Windows-only project, not in this repo).
- Supabase is preconfigured in the committed `.env` (anon/publishable keys only). Durable persistence (writing users/billing) needs a Supabase **service-role** key, which is NOT set, so in local dev registrations are kept **in-memory only** — they do not write to the hosted Supabase. This makes registration safe to test repeatedly.

### Lint
`bun run lint` runs ESLint + Prettier and currently reports ~8,800 **pre-existing** `prettier/prettier` errors: 26 committed source files use CRLF line endings while Prettier is configured for LF (`Delete ␍`). These are not caused by environment setup — do not "fix" them as part of setup.

### Build
`bun run build` builds the client + Nitro server into `.output/` (Cloudflare target). Deploy is via `wrangler deploy` (`wrangler.jsonc`, worker name `sniper-bo-ia`).

### Optional FastAPI billing backend (`backend/`)
Optional/alternate billing stack. Needs the `python3-venv` system package. It defaults to **SQLite** (`sqlite:///./sniperbo.db`) and only requires `APP_JWT_SECRET` (≥32 chars) in `backend/.env`. Run: create venv, `pip install -r requirements.txt`, then `./.venv/bin/uvicorn app.main:app --port 8000`. `backend/.env`, `backend/.venv/`, and `backend/sniperbo.db` are local-only and must not be committed.

### Windows-only scripts
Everything under `scripts/*.ps1` (and the `signals:start` / `watchdog:start` npm scripts) is Windows PowerShell for the production live-data pipeline. On Linux run the underlying `node`/`python` commands directly instead.
