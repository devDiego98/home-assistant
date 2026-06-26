# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Casa

Self-hosted, privacy-first home assistant. All camera and device data stays on the home network. Remote access is via **Tailscale VPN only** — never open ports.

## Monorepo Structure

```
home-assistant/
├── apps/
│   ├── backend/        # Fastify API — Node.js + TypeScript
│   └── mobile/         # Expo React Native app — TypeScript
├── packages/
│   └── shared/         # Shared TypeScript types (imported by both apps)
├── infra/              # Docker Compose, Nginx, Frigate, Mosquitto configs
└── ai/                 # Python AI/ML scripts (future)
```

Package manager: **pnpm 8** with workspaces. Package names are `@casa/backend`, `@casa/mobile`, `@casa/shared`.

## Common Commands

```bash
# Install deps (always from repo root)
pnpm install

# Run backend in dev (hot-reload)
pnpm backend
# or: pnpm --filter @casa/backend dev

# Run mobile app
pnpm mobile
# or: pnpm --filter @casa/mobile start

# Build shared types (required before building other packages)
pnpm --filter @casa/shared build

# Typecheck all workspaces
pnpm typecheck

# Database migrations (from apps/backend/)
pnpm --filter @casa/backend db:generate   # generate SQL from schema
pnpm --filter @casa/backend db:migrate    # apply to DB
pnpm --filter @casa/backend db:studio     # open Drizzle Studio
```

## Backend Architecture (`apps/backend/`)

- **Framework**: Fastify 4 with ES modules (`"type": "module"`)
- **Database ORM**: Drizzle ORM with `node-postgres` driver — schema lives in `src/db/schema/`
- **Auth**: `@fastify/jwt` — access tokens (15 min) + refresh tokens stored in DB
- **Real-time**: `@fastify/websocket` — WebSocket at `/api/ws/events`, events broadcast via Redis pub/sub channel `ws:broadcast`
- **Config**: All env vars validated with zod at startup in `src/config.ts` — process exits if invalid
- **Dev server**: `tsx watch` (no build step needed in dev)

Route prefix convention: `/api/<resource>`. All routes except `/api/auth/login` and `/health` require a valid JWT in `Authorization: Bearer <token>`.

Adding a new route: create `src/routes/<name>.ts` exporting a `FastifyPluginAsync`, then register it in `src/index.ts` with a prefix.

## Shared Types (`packages/shared/`)

**Always** add new cross-cutting types here, not in `backend/` or `mobile/`. Both apps import from `@casa/shared`.

Must run `pnpm --filter @casa/shared build` after changing types for the backend to pick up changes (mobile uses a TypeScript path alias that points to source directly).

Key types: `User`, `Device`, `Camera`, `Alert`, `Automation`, `ApiResponse<T>`, `WsEvent<T>`.

## Mobile Architecture (`apps/mobile/`)

- **Router**: Expo Router (file-based) — screens are files under `app/`
- **Auth guard**: `app/(tabs)/_layout.tsx` redirects to `/login` if no user in `useAuthStore`
- **State**: Zustand stores in `app/store/` — auth state persisted via `expo-secure-store`
- **API client**: `app/services/api.ts` — typed wrapper around `fetch`, reads token from SecureStore
- **WebSocket**: `app/services/websocket.ts` — singleton `casaWs`, auto-reconnects, exposes `subscribe(handler)`
- **API URL**: Set via `EXPO_PUBLIC_API_URL` env var (Tailscale IP in production, `http://localhost:3000` in dev)

## Infrastructure (`infra/`)

Start all services: `cd infra && docker compose up -d`

Services exposed locally only (127.0.0.1) except Nginx (public 80/443). Nginx proxies `/api/*` → backend, `/frigate/*` → Frigate NVR.

Key config files:
- `infra/docker-compose.yml` — all services
- `infra/frigate/config.yml` — add cameras here (RTSP URLs)
- `infra/mosquitto/mosquitto.conf` — MQTT broker
- `infra/nginx/conf.d/casa.conf` — reverse proxy + TLS

Copy `infra/.env.example` to `infra/.env` and set passwords before running.

## Environment Setup

Backend needs `apps/backend/.env` (copy from `.env.example`). Critical vars:
- `DATABASE_URL`, `REDIS_URL` — connection strings
- `JWT_SECRET` — must be 32+ chars

Mobile needs `apps/mobile/.env` (copy from `.env.example`):
- `EXPO_PUBLIC_API_URL` — Tailscale IP of the home server
