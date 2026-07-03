# SniperBO (sniper-bo-ia)

Real-time casino "Bac Bo"/Baccarat betting-signals SaaS (pt-BR). Monorepo with a primary web app plus optional auxiliary services.

## Cursor Cloud specific instructions

These notes are for agents running in a Cursor Cloud VM where the startup/update script has already installed dependencies. They capture non-obvious caveats only; standard commands live in `package.json` and `backend/README.md`.

### Services overview

| Service | Path | Run command | Notes |
| --- | --- | --- | --- |
| Main web app (frontend + SSR "signals API") | repo root | `npm run dev` (= `vite dev`) | The product. Serves UI + all `/auth`, `/billing`, `/sales`, etc. SSR endpoints from `src/server.ts`. Listens on `http://127.0.0.1:5175` (`strictPort`). Required. |
| FastAPI Hubla billing backend | `backend/` | `backend/.venv/bin/uvicorn app.main:app --port 8000` | Optional, isolated. Defaults to SQLite. `/docs` serves OpenAPI; most `/api/*` routes require a Bearer JWT. |
| Cloudflare Telegram engine | `cloudflare/telegram-engine/` | `wrangler dev` | Optional. Broadcasts signals to Telegram. |

Windows-only ops scripts (`signals:start`, `watchdog:start`, `ports:audit`, `scripts/*.ps1`) do not run on Linux and are not needed for development.

### Package manager: bun (not npm)

The only lockfile is `bun.lock` (despite `package.json` declaring `npm`). Install deps with `bun install`. `bun` is installed at `~/.bun/bin/bun`; if it is not on `PATH`, call it by full path or prepend `~/.bun/bin` to `PATH`. The npm `scripts` themselves (`dev`, `build`, `lint`) are runnable with either `npm run <script>` or `bun run <script>`.

### Auth/registration needs SNIPER_SESSION_SECRET (non-obvious)

The SSR server only loads server-side secrets from the actual process environment (`process.env`); it does NOT auto-load the repo `.env` for server code (`.env` is consumed by Vite only for `VITE_`-prefixed client vars). Auth endpoints (`/auth/check`, `/auth/register`, `/auth/verify`) return `503 "Sessao nao configurada no servidor."` unless `SNIPER_SESSION_SECRET` is set in the environment of the dev server process.

To exercise the core register/login → dashboard flow locally, start the dev server with the secret exported, e.g.:

```bash
SNIPER_SESSION_SECRET="dev-local-session-secret-please-change-32chars" npm run dev
```

Registration/login then succeed in-memory. Durable persistence to Supabase is optional: with no `SUPABASE_SERVICE_ROLE_KEY` configured, registration is treated as successful (stored in live in-memory state) and the user gets a 7-day demo session. Supabase client (`VITE_SUPABASE_*`) values for the frontend already live in `.env`.

### Lint caveat

`npm run lint` runs ESLint + Prettier and currently reports thousands of pre-existing `prettier/prettier` errors caused by CRLF line endings in committed source (the repo is Windows-authored). These are not environment problems — the lint tool itself works. Do not mass-reformat unless asked.

### Backend dev notes

`backend/` reads config via `pydantic-settings` from env vars or a `backend/.env` file. `APP_JWT_SECRET` is required and validated (must be ≥32 chars and not a known weak/example value). Without a `DATABASE_URL` it uses SQLite (`backend/sniperbo.db`, auto-created on startup). Set `EMAIL_ENABLED=false` locally to avoid SMTP.
