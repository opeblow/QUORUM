<div align="center">

# Quorum

### Meetings that think with you.

**A video meeting room with a team of AI agents inside it — built in Africa, for Africa and the world.**

[![License: MIT](https://img.shields.io/badge/License-MIT-e8590c.svg)](LICENSE)
[![Built on Mozaik](https://img.shields.io/badge/Built%20on-Mozaik-141413.svg)](https://github.com/jigjoy-ai/mozaik)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.base.json)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000.svg)](apps/web)
[![WebRTC](https://img.shields.io/badge/Calls-WebRTC-2f7d4f.svg)](apps/web/src/hooks/use-call.ts)
[![Tests](https://img.shields.io/badge/tests-43%20passing-2f7d4f.svg)](#testing)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-e8590c.svg)](CONTRIBUTING.md)

<img src="apps/web/public/product/room.png" alt="A live Quorum meeting: transcript, five agents working, fact-checks, decisions and approved action items" width="100%" />

<sub>A real meeting in Quorum. Nothing staged.</sub>

</div>

---

## Table of contents

1. [The problem](#the-problem)
2. [Why it matters — especially in Africa](#why-it-matters--especially-in-africa)
3. [The solution](#the-solution)
4. [Features](#features)
5. [The agent team](#the-agent-team)
6. [How it works](#how-it-works)
7. [How we use each technology](#how-we-use-each-technology)
8. [Architecture](#architecture)
9. [Scale](#scale)
10. [Getting started](#getting-started)
11. [Configuration](#configuration)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Project structure](#project-structure)
15. [Roadmap](#roadmap)
16. [Contributing, security & privacy](#contributing-security--privacy)
17. [License](#license)

---

## The problem

Meetings are where organisations decide things — and where those decisions get lost.

- **Wrong facts go unchallenged.** A confident wrong number in a meeting becomes the basis of a decision.
- **Decisions evaporate.** Two weeks later nobody agrees on what was agreed, or why.
- **"I'll do it" never becomes a task.** Commitments made out loud aren't written down, owned or dated.
- **Groupthink wins.** When a room agrees quickly, nobody asks the uncomfortable question.
- **Every meeting starts from zero.** Teams re-decide things they already decided — or contradict themselves without noticing.
- **Late joiners are lost**, and people who couldn't attend have nothing reliable to read.

Today's tools split this badly: a call app shows faces, and an AI note-taker writes a summary *afterwards*. By then the wrong fact has already shaped the decision.

## Why it matters — especially in Africa

- **Data is expensive and networks vary.** Heavy desktop apps and high-bitrate video exclude people on mobile data. Quorum runs in the browser with a **data-saver mode**.
- **People speak many languages and accents.** Transcription tuned for American English fails on Nigerian, Kenyan, South African or Ghanaian English, Kiswahili or isiZulu. Quorum lets every participant pick their own speech language.
- **WhatsApp is how people share.** Invites go out over WhatsApp in one tap.
- **Distributed teams can't afford re-work.** Startups, NGOs, governments and universities across the continent need decisions that stick.

## The solution

**Quorum puts a team of specialist AI agents inside the meeting room.** You talk face to face — in the browser, no install — and while you talk, the agents work **at the same time**:

| | |
|---|---|
| A claim is made | the **Fact-Checker** verifies it against the web, with sources and a correction |
| The room commits | the **Decision Tracker** records the decision and the reason |
| Someone says "I'll…" | the **Action Owner** drafts an owned, dated action item — and **waits for a human yes** |
| Everyone agrees too fast | the **Devil's Advocate** raises the strongest counter-argument |
| A decision contradicts last month | the **Memory Keeper** flags it, quoting the earlier meeting |
| Always | the **Scribe** keeps a running summary, so late joiners catch up in seconds |

When the host ends the meeting, everyone lands on the same **recap**.

## Features

**Meetings**
- HD video and audio calls in the browser (WebRTC), guests join with just a name
- Mute / unmute, camera on / off, **screen sharing** with presenter layout
- **Data-saver mode** (360p, 15 fps, capped bitrate) for mobile networks
- **Chat** with **file sharing** (PDF, images, Office files, CSV — up to 10 MB)
- Invite by link, **WhatsApp**, email or the phone's share sheet
- Speech recognition in **African languages and accents** — English (Nigeria, Kenya, South Africa, Ghana, Tanzania), Kiswahili, isiZulu, Afrikaans, Amharic, Arabic, French, Portuguese
- **Catch me up** — what you missed, opened automatically for late joiners

**Intelligence**
- Five concurrent agents + team memory across meetings (see below)
- Human approval before anything is done on someone's behalf
- Every fact-check cites its sources; "can't verify" beats guessing

**Records**
- Live transcript, decisions, action items, fact-checks, challenges and chat — saved
- Recap page with **copy as Markdown** for Slack, Notion, Linear or email

## The agent team

| Agent | Wakes up when… | Does | Model tier |
|---|---|---|---|
| **Scribe** | every few lines | running summary + topic outline | fast |
| **Fact-Checker** | a checkable claim is made | web search → verdict, correction, sources | smart |
| **Decision Tracker** | commitment language | records new decisions with rationale | fast |
| **Action Owner** | "I'll…", "can you…" | proposes action items → **pauses for approval** | fast |
| **Devil's Advocate** | agreement piles up with no pushback (*room state*, not a keyword) | strongest counter-argument + one question | smart |
| **Memory Keeper** | a decision is recorded, or someone says "last time…" | searches team memory; flags contradictions | fast |

Plus three rule-based participants: the **Moderator** (budgets, approvals, vetoes a proposal when the Fact-Checker refutes its premise), the **Archivist** (writes decisions to team memory) and the **Tap** (streams events to the browser).

## How it works

```
 you speak ──▶ browser speech-to-text ──▶ room server ──▶ Mozaik runtime (one per meeting)
                                                              │  every agent hears every line
                         ┌──────────────┬──────────────┬─────┴────────┬──────────────┐
                    Fact-Checker   Decision Tracker  Action Owner  Devil's Advocate  Memory Keeper …
                         │              │              │ (pauses → you approve)        │
                         └──────────────┴──── shared room state (locks, budget) ───────┘
                                                              │
                     live cards ◀── WebSocket ◀── room server ┴──▶ Postgres (recap) · mem0 (memory)
```

Agents are **not** a pipeline: they run concurrently, each deciding for itself when to act, and coordinate through shared state — a claim is locked by whoever checks it, so it's never checked twice; a refuted claim vetoes the action item built on it.

## How we use each technology

| Technology | How Quorum uses it |
|---|---|
| **[Mozaik](https://github.com/jigjoy-ai/mozaik)** (`@mozaik-ai/core` 4.1) | The heart. One runtime per meeting; every agent, human and observer is a Mozaik **participant**; agents react through **situation handlers** (event- *and* state-based); **interception** pauses tool calls for human approval and lets one agent stop another; **shared RuntimeState** carries locks, a loop semaphore and the token budget. We also harden it: loops never reject, handlers are isolated, fresh context per loop ([details](RESEARCH.md#runtime-behaviours-found-while-building-410--and-how-we-handle-them)). |
| **OpenAI** (and Anthropic, Gemini) | Model inference through Mozaik's provider layer. Fast models for frequent work, smart models for verdicts and challenges; automatic **cross-provider failover**, retries and timeouts; structured (schema-validated) outputs. |
| **[Tavily](https://tavily.com)** | The Fact-Checker's `web_search` tool: focused queries, results with URLs the model must cite. |
| **[mem0](https://mem0.ai)** | Team memory across meetings: the Archivist stores decisions and approved actions; the Memory Keeper searches them and flags contradictions. |
| **WebRTC** | Peer-to-peer video, audio and screen share with "perfect negotiation"; media never touches our servers. |
| **Next.js 16 + Better Auth** | Web app, accounts, guest (anonymous) sessions, room tickets, file sharing, recap. |
| **Postgres (Neon) + Drizzle** | Users, rooms, meeting snapshots, shared files. |
| **Fastify + ws** | The real-time room server. |

## Architecture

Three deployables, one repo:

| Part | Tech | Role |
|---|---|---|
| `apps/web` | Next.js 16, Better Auth | Landing, accounts, dashboard, room UI, recap, uploads, room tickets |
| `apps/rooms` | Fastify + WebSockets + Mozaik | Live rooms: one agent runtime per meeting, event streaming, WebRTC signalling |
| `packages/engine` | TypeScript + Mozaik | Agents, shared state, coordination, resilience |
| `packages/protocol` | zod | The wire contract between browser and room server |
| `packages/db` | Drizzle + Postgres | Schema and migrations |

Deep dives: [ARCHITECTURE.md](ARCHITECTURE.md) · [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md) · [RESEARCH.md](RESEARCH.md).

## Scale

Measured on one process: **1,000 live sockets across 200 meetings, p95 event latency 37 ms, zero message loss** ([load test](apps/rooms/scripts/loadtest.ts)). Room servers scale horizontally with **rendezvous-hash routing** — no coordinator, adding a machine moves only ~1/N meetings. The real constraint at millions of users is model throughput and cost; the plan is in [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md#4-capacity--the-real-bottleneck-is-model-throughput-and-cost).

## Getting started

**Requirements:** Node 24+, pnpm 11+, Chrome or Edge (for live speech).

```bash
git clone <this-repo> quorum && cd quorum
pnpm install
cp .env.example .env.local          # then fill in keys (see below)
pnpm db:local                       # terminal 1 — local Postgres (or use Neon)
pnpm db:migrate
pnpm --filter @quorum/rooms dev     # terminal 2 — room server  :4000
pnpm --filter @quorum/web dev       # terminal 3 — web app      :3000
```

Open http://localhost:3000, create an account, start a room, share the link.

## Configuration

All apps read one root `.env.local` (never committed). Minimum to run:

| Variable | Needed for |
|---|---|
| `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`) | the agents |
| `TAVILY_API_KEY` | the Fact-Checker |
| `MEM0_API_KEY` | the Memory Keeper |
| `DATABASE_URL` | accounts, rooms, recaps, files |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | sign-in |
| `ROOMS_JWT_SECRET`, `NEXT_PUBLIC_ROOMS_URL` | web ↔ room server |
| `NEXT_PUBLIC_TURN_URLS` (+ username/credential) | calls on strict networks (production) |

Full list with comments: [.env.example](.env.example).

## Testing

```bash
pnpm --filter @quorum/engine test   # 27 unit + integration (real Mozaik runtime, scripted model)
pnpm --filter @quorum/rooms test    # 10 server tests (real WebSockets, JWTs, routing)
pnpm e2e                            # 6 browser tests (real models, real mem0, real WebRTC)
```

The end-to-end suite holds a full meeting in two real browsers: sign-up → room → guest joins → **live video both ways** → mute, camera, data saver, **screen share** → invite → **chat with a file** → fact-check → decision → approval → action → end → recap; plus a two-meeting **team-memory** test and visual checks on desktop and phone.

## Deployment

Database on **Neon**, room servers on **Fly.io**, web on **Vercel**. Step-by-step: [SETUP.md §5](SETUP.md). Docker image: [`apps/rooms/Dockerfile`](apps/rooms/Dockerfile). CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Project structure

```
apps/
  web/        Next.js app (landing, auth, dashboard, room, recap, uploads)
  rooms/      real-time room server (Fastify + ws + Mozaik)
packages/
  engine/     agents, shared state, coordination, resilience (Mozaik adapter)
  protocol/   zod wire contract
  db/         Drizzle schema + migrations
```

## Roadmap

- **Large meetings:** SFU (LiveKit / Cloudflare Calls) for calls beyond ~6 video participants
- **More African languages:** Yoruba, Hausa, Igbo, Kinyarwanda, Luganda speech via server-side ASR
- **Live translation** of captions between participants' languages
- **Offline-tolerant mobile app** and USSD/SMS recap delivery
- **Organisations** with shared team memory and admin controls
- Redis (Upstash) room claims and shared rate limits for multi-region clusters

## Contributing, security & privacy

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to set up, conventions, pull requests
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities, our security model
- [PRIVACY.md](PRIVACY.md) — what we store, what we don't, your rights
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — how we treat each other

## License

[MIT](LICENSE) — free to use, modify and distribute.

<div align="center"><sub>Built on <a href="https://github.com/jigjoy-ai/mozaik">Mozaik</a> · Made for the JigJoy × NTP Novi Sad Hackathon 2026</sub></div>
