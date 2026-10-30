# SETUP.md — Accounts, keys, local dev, deploy

## 0. Prerequisites
- Node **24.x** (installed: v24.16.0) · pnpm 10 (`npm i -g pnpm`) · Git · GitHub account
- Windows: use Git Bash or PowerShell 7; repo paths with spaces must be quoted ("3alet hack").

## 1. Accounts to create (all have free tiers) — do these BEFORE kickoff
| Service | Why | Env vars |
|---|---|---|
| Hackathon registration | **Deadline 27 Oct** — https://jigjoy.ai/hackathon-2026 | — |
| Mozaik Cloud — app.jigjoy.ai | Live agent-run links for judges | `MOZAIK_CLOUD_ENDPOINT`, `MOZAIK_CREDENTIALS_FILE`, `MOZAIK_REDACTION` |
| Anthropic | Main reasoning models | `ANTHROPIC_API_KEY` |
| OpenAI and/or Google AI Studio | Cheap triage + fallback | `OPENAI_API_KEY`, `GEMINI_API_KEY` |
| mem0 Platform — app.mem0.ai | Team memory (sponsor) | `MEM0_API_KEY` |
| Deepgram | Streaming speech-to-text | `DEEPGRAM_API_KEY` |
| Tavily (or Exa) | Web search tool for Fact-Checker/Researcher | `TAVILY_API_KEY` |
| Clerk | Auth | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| Neon | Postgres | `DATABASE_URL` |
| Upstash Redis | Room affinity + rate limits | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Vercel | Host apps/web | — |
| Fly.io | Host apps/rooms | `FLY_API_TOKEN` (CI) |
| Sentry | Errors | `SENTRY_DSN` |
| (stretch) Linear / Slack | Action tools | `LINEAR_API_KEY`, `SLACK_WEBHOOK_URL` |

Set **spend limits** on every LLM/STT provider dashboard before going public.

## 2. Environment files
- Root `.env.local` (used by the engine spike; overrides `.env`), later `apps/web/.env.local` and `apps/rooms/.env` — never committed. `.env.example` in each app lists every key (no values).
- Shared secret `ROOMS_JWT_SECRET`: web signs short-lived room tokens; rooms verifies them.
- `ROOMS_PUBLIC_URL` (web → where browsers open the WS), `WEB_PUBLIC_URL`.

## 3. Local dev
```bash
pnpm install
pnpm db:local            # terminal 1: real Postgres 17 on :54329 (no Docker needed)
                         #   or: docker compose up -d   (same URL)
pnpm db:migrate          # apply migrations
pnpm --filter @quorum/rooms dev   # terminal 2: room server on :4000
pnpm --filter @quorum/web dev     # terminal 3: web on :3000 → http://localhost:3000
pnpm test                # unit + integration (scripted model, no tokens spent)
pnpm e2e                 # real browser + real models (needs web + rooms + db running)
```
All three read the repo-root `.env.local`. Live speech needs Chrome or Edge; typing works everywhere.

## 4. Mozaik version
`@mozaik-ai/core` is pinned to **exactly `4.1.0`** (no caret). npm `latest` is an unstable 4.2 beta with a different API. See RESEARCH.md §3. Do not bump without updating `packages/engine/src/mozaik/` only.

## 5. Deploy
Order: database → room server → web. All commands from the repo root.

**1. Database (Neon)**
```bash
DATABASE_URL="postgres://…neon.tech/quorum?sslmode=require" pnpm db:migrate
```

**2. Room server (Fly.io)** — config in `apps/rooms/fly.toml`, image `apps/rooms/Dockerfile`
```bash
fly launch --no-deploy --copy-config --config apps/rooms/fly.toml   # first time only
fly secrets set --config apps/rooms/fly.toml   ROOMS_JWT_SECRET=… DATABASE_URL=… ALLOWED_ORIGINS=https://<web-domain>   OPENAI_API_KEY=… TAVILY_API_KEY=… MEM0_API_KEY=… MOZAIK_API_KEY=… MOZAIK_REDACTION=true
fly deploy --config apps/rooms/fly.toml --dockerfile apps/rooms/Dockerfile
```
Scale out with `fly scale count N`: rooms are routed to their owning machine automatically (rendezvous hashing + `fly-replay`, see SYSTEM-DESIGN.md). Each machine hosts up to `MAX_ROOMS` (default 200).

**3. Web (Vercel)** — import the repo, Root Directory `apps/web`, framework Next.js.
Env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<web-domain>`, `ROOMS_JWT_SECRET` (same as rooms), `NEXT_PUBLIC_ROOMS_URL=wss://quorum-rooms.fly.dev/ws`.

**4. Verify**: `E2E_BASE_URL=https://<web-domain> pnpm e2e` (real models; spends a few cents).

CI (`.github/workflows/ci.yml`) typechecks, runs unit + integration tests and builds both apps on every push/PR.

## 6. Pre-demo checklist
- [ ] Prod URL works in a fresh incognito browser on laptop **and** phone
- [ ] Spend caps set; per-room budget verified
- [ ] Mozaik Cloud receiving events (redaction on)
- [ ] Backup: recorded demo video + a seeded recap page, in case venue Wi-Fi fails
