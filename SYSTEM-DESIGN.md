# SYSTEM-DESIGN.md — Quorum at scale

Status: 18 Oct 2026. Numbers marked **measured** come from our own tests; everything else is a planning estimate.

## 1. What "millions of users" means for this system

Users are not concurrent. A meeting product's load is driven by **concurrent participants** and **concurrent rooms**.

| Assumption (adjust to your funnel) | Value |
|---|---|
| Monthly active users | 1,000,000 |
| Peak concurrent participants (≈3% of MAU, business-hours peak) | 30,000 |
| Average participants per room | 4 |
| Peak concurrent rooms | 7,500 |

Everything below is sized for that peak, with headroom to 10×.

## 2. Architecture

```
Browser ──HTTPS──▶ Web (Next.js, Vercel, stateless, autoscaled)
   │                    │  auth (Better Auth, cookie-cached sessions), dashboard, recap, room tickets
   │                    ▼
   │               Postgres (Neon, pooled)  ◀── room snapshots / meeting status (room servers write)
   │
   ├──WSS /ws?room=…──▶ Room cluster (Fly.io, N machines)
   │                    │  rendezvous-hash routing: any machine → fly-replay → the room's owner
   │                    │  one Mozaik runtime per live room, in memory
   │                    ├──▶ LLM providers (OpenAI / Anthropic / Gemini, cross-provider failover)
   │                    ├──▶ Tavily (fact-check search)
   │                    └──▶ mem0 (team memory across meetings)
   │
   └──WebRTC (P2P, STUN/TURN)──▶ other participants   (media never touches our servers)
```

Key properties:
- **Stateless edge, stateful core.** Only the room cluster holds live state, and only per room. Everything else scales horizontally with no coordination.
- **No coordinator for rooms.** Each room's home machine is computed by rendezvous hashing over the live machine list (Fly internal DNS). Adding a machine moves ~1/N of rooms (**measured**: <13% at N=10→11, all to the new machine). A room already live on a machine stays there through scale events.
- **Media is peer-to-peer.** Video/audio never transits our servers, so call bandwidth costs us nothing and scales with users.
- **Bulkheads.** Every agent loop is isolated: provider failures, timeouts and bad outputs end that loop with a signal, never the process (see RESEARCH.md §3).

## 3. Capacity — realtime layer (**measured**)

Single Node process (laptop-class CPU), real server + WebSockets + Mozaik runtime, scripted model:

| Load | Fan-out latency p50 / p95 / p99 | Event-loop delay p99 | Memory (RSS) | Delivery |
|---|---|---|---|---|
| 200 rooms × 5 clients = 1,000 sockets | **9 / 37 / 74 ms** | 52 ms | 377 MB | 14,000 / 14,000 |

Run it yourself: `pnpm --filter @quorum/rooms exec tsx scripts/loadtest.ts 200 5 30`.

Sizing at peak (7,500 rooms): at 200 rooms/machine → **~38 room machines** (`shared-cpu-2x`, 1 GB); plan 50 for headroom. `MAX_ROOMS` caps each machine so overload becomes a clean `server_busy` instead of degradation.

## 4. Capacity — the real bottleneck is model throughput and cost

**Measured** on the sample meeting with the full roster: **~22k tokens per meeting-minute** (≈90% input).

| Peak rooms | Tokens / minute | Implication |
|---|---|---|
| 100 | 2.2 M | Fits standard provider tiers |
| 1,000 | 22 M | Needs high provider tiers + multi-provider spread |
| 7,500 | 165 M | **Exceeds typical rate limits** — needs the measures below |

Required before scaling past ~1,000 concurrent rooms (in priority order):
1. **Token diet** (largest lever, est. 3–5×): incremental Scribe summaries instead of full rewrites; prompt caching for stable instructions; smaller context windows for triage; skip agents whose triage didn't fire (already true for most).
2. **Cheap-model routing**: fast tier for everything except fact-check verdicts and challenges (already tiered); add a nano-tier triage step before smart calls.
3. **Provider pooling**: enterprise rate limits across OpenAI + Anthropic + Gemini (the fallback chain already supports it); per-provider token buckets in the room cluster.
4. **Plan-based budgets**: per-room hard caps already exist (`ROOM_HARD_TOKENS`); tie them to plans, and degrade gracefully (Moderator already halves concurrency and downgrades models under pressure).

## 5. Other components at peak

| Component | Load at peak | Plan |
|---|---|---|
| Web (Vercel) | ~30k ticket mints/min on reconnect storms, page views | Autoscaled; sessions validated from a signed cookie cache (5 min), so most requests never hit Postgres |
| Postgres (Neon) | Snapshot writes ≤ 1 per room per 5 s (≈1.5k/s at peak), auth writes | Pooled connections, `prepare: false`; writes are coalesced per room. Scale Neon compute; move snapshots to a dedicated table/partition if needed |
| mem0 | 1 write per decision/approved action; 1 search per decision | Measured ~2.5 s write, searchable ~3 s later; async, off the critical path |
| Tavily | ~1–3 searches per checkable claim | Rate-limit per room via the Fact-Checker's bounded queue (max 2 concurrent, 4 pending) |
| TURN | ~15–20% of calls need relay | **Required for production**: managed TURN (e.g. Cloudflare, Twilio). Configure `NEXT_PUBLIC_TURN_URLS`/`_USERNAME`/`_CREDENTIAL` |

## 6. Known limits & next steps (honest list)

| Limit | Impact | Fix |
|---|---|---|
| P2P mesh video | Good up to ~6 people per call; beyond that uplink saturates | Add an SFU (LiveKit or Cloudflare Calls) for large rooms |
| Room rehydration after a machine dies | A crashed machine's live rooms restart empty (recaps are safe in Postgres) | Rehydrate RoomStore from the last snapshot on first join |
| Split room during scale-in races | Rare; two machines could host the same room briefly | Redis `SET NX` room claim with heartbeat (design in ARCHITECTURE §5) |
| Better Auth rate limiting is per instance | Weaker abuse protection on autoscaled web | Back it with Redis secondary storage |
| Memory scope = room owner | Teams/orgs not modelled yet | Add orgs; scope memory by org |

## 7. Operational readiness

- Health: `/healthz` (liveness), `/readyz` (drains to 503 on shutdown; reports rooms/clients/capacity).
- Graceful deploys: SIGTERM → stop accepting → final snapshots saved → clients told to reconnect.
- Security: short-lived signed room tickets, origin allowlist, per-socket rate limits, zod-validated input, redacted error reasons, host-only "end", human approval for consequential actions, CSP-adjacent headers, camera/mic allowed only for self.
- Tests: 27 engine + 10 room-server unit/integration, 6 browser end-to-end on production builds (real models, real mem0, real WebRTC).
