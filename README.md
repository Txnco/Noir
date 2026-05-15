# Noir

Student nightlife platform — monorepo with a Next.js web app, FastAPI backend, nginx reverse proxy, and Redis. All orchestrated with Docker Compose.

## Running locally

Start everything **with the `--watch` flag** — this is what gives you live hot reload:

```
docker compose up --build --watch
```

Then open **http://localhost**.

The first run builds the images (takes a few minutes). Every run after that is fast — drop `--build` once the images exist:

```
docker compose up --watch
```

> **Why `--watch`?** Next.js 16 uses Turbopack, whose file watcher does not see
> changes through a Windows→Linux bind mount. `--watch` makes Compose actively
> *sync* your edits into the container, which Turbopack then hot-reloads. Without
> `--watch`, the container just runs a frozen snapshot of the code.

## When to do what

Keep `docker compose up --watch` running in a terminal. Then:

| What you changed | What to run |
| --- | --- |
| Frontend code in `apps/web/` (components, pages, styles, etc.) | **Nothing.** Just save — Compose syncs it and the page hot-reloads. |
| Added or removed an npm package (`package.json` / `package-lock.json` changed) | **Nothing** — `--watch` auto-rebuilds the `web` image. (Or `docker compose up --build web` if not watching.) |
| Backend Python code in `apps/backend/` | `docker compose restart backend` |
| Backend dependencies (`requirements.txt` / `pyproject.toml`) | `docker compose up --build backend` |
| Changed an `.env` file | `docker compose up -d` (recreates containers with new env) |
| Changed `nginx.conf` | `docker compose restart nginx` |
| Changed any `Dockerfile` or `docker-compose*.yml` | `docker compose up --build --watch` |
| Want a clean slate | `docker compose down -v` then `docker compose up --build --watch` |

## Useful commands

```
docker compose up               # start everything (dev mode by default)
docker compose up -d            # start in the background
docker compose down             # stop everything
docker compose logs -f web      # tail the web app logs
docker compose logs -f backend  # tail the backend logs
docker compose ps               # see what's running
```

## Production-style build

The override file is for dev. To run the production build of the web app locally (no hot reload, much slower iteration but matches deploy):

```
docker compose -f docker-compose.yml up --build
```

## Project layout

```
apps/
  web/        Next.js 16 frontend (TypeScript, Tailwind v4)
  backend/    FastAPI + SQLAlchemy
  nginx/      Reverse proxy — entry point at http://localhost
packages/     Shared workspace packages
```

## Fonts & logo

- Fonts live in `apps/web/public/assets/fonts/` — **Fraunces** for headlines (`font-display`) and **Montserrat** for body (`font-sans`). Loaded via `next/font/local` in [apps/web/app/layout.tsx](apps/web/app/layout.tsx).
- Logo SVGs are in `apps/web/public/assets/logo/`. Use the [`<Logo />`](apps/web/components/Logo.tsx) component everywhere — never hardcode the wordmark:

  ```tsx
  import Logo from "@/components/Logo";

  <Logo href="/" height={32} />                  // dark wordmark (light bg)
  <Logo tone="light" height={28} />              // white wordmark (dark bg)
  <Logo variant="monogram" tone="light" height={48} />
  ```

## Troubleshooting

- **Changes not showing up?** You almost certainly forgot `--watch`. Stop, then run `docker compose up --watch`. The terminal should print `⦿ watch enabled` and log `Syncing service "web"...` when you save a file.
- **`npm ci` / build errors after pulling new code?** Someone bumped deps — run `docker compose up --build --watch`.
- **Port 80 already in use?** Stop whatever's holding it (IIS, Skype, another nginx), or change the nginx port mapping in `docker-compose.yml`.
- **Totally stuck?** Clean slate: `docker compose down -v` then `docker compose up --build --watch`.
