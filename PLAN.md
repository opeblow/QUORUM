# PLAN.md — Road to winning

Today: **Sun 18 Oct 2026**. Kickoff: **Fri 30 Oct**. Submission: **Sat 31 Oct**. Solo builder.

Guiding rules
1. **Concurrency is the product.** Every feature must make "agents running together" more visible or more real.
2. Real everything: real STT, real LLMs, real search, real auth, real DB, real deploy. No mocked data or fake UI states. (Scripted inference runner exists **only** in CI tests.)
3. Ship a deployed URL every day from Phase 1 onward.
4. Confirm on Discord whether pre-kickoff code is allowed. If **not**: Phase 1–2 output becomes knowledge + throwaway spikes, and we rebuild fast at kickoff from these docs.

---

## Phase 0 — Foundations (18–20 Oct)
- [x] Research hackathon, judges, Mozaik (RESEARCH.md)
- [x] Product, architecture, UI, setup, plan docs
- [ ] Register for hackathon (choose **on-site** if possible: mentors + internship eligibility)
- [ ] Join Discord; ask about pre-built code + submission format
- [ ] Create accounts & keys (SETUP.md §1), set spend caps
- [ ] Do the Mozaik 7-lesson mini-course + run 3 examples locally (shared-state, human-in-the-loop, inference-interception)

## Phase 1 — Engine spike (started 18 Oct)  ← proves the core risk
- [x] Monorepo scaffold (pnpm + turbo, packages/engine) — packages/protocol moves to Phase 2 with the WS gateway
- [x] `createRoom` = one isolated Mozaik runtime per room; 2 concurrent rooms proven isolated (integration test)
- [x] RoomState + LockTable + Semaphore + WorkQueue + TokenBudget + ApprovalBroker (unit tested)
- [x] 5 agents: Scribe, Fact-Checker (Tavily), Decision Tracker, Action Owner, Devil's Advocate — concurrency proven (≥3 loops in flight)
- [x] State-based spec (Devil's Advocate: consensus without dissent) + human-approval interception + **agent-to-agent veto** (refuted claim auto-rejects dependent proposal)
- [x] Resilience: retries/fallback/timeouts, failures contained per agent, budget hard-stop, forged-approval protection — 22 tests green
- [x] Auditor → kaleidoskop-shaped JSONL in `.audit/`
- [x] **Ran the spike with real keys** (OpenAI + Tavily): all 5 agents correct on the sample — 3 facts verified w/ sources, myth refuted, decision, challenge, 2 actions, no duplicates. Fixed 4 quality bugs found live (claim recall, duplicate actions, dissent streak, new-vs-context lines)
- [x] Measured: ~22k tokens/meeting-minute → 30-min meeting ≈ 650k tokens with gpt-5.5/5.4-mini. Token optimisation (Scribe re-summaries dominate) is a Phase 2 item
- [ ] Get `MOZAIK_API_KEY` (app.jigjoy.ai) → live cloud run links
- [ ] Load an audit log into kaleidoskop.jigjoy.ai and adjust mapping (its domains are baro-shaped; expect partial fit)
- [ ] Mozaik Cloud events visible
- **Exit criteria:** p50 < 3s from utterance to first card; 2 rooms don't leak state (tested); cost per 30-min meeting estimated.

## Phase 2 — Product skeleton (started 18 Oct)
- [x] packages/protocol (zod wire contract) · apps/rooms (Fastify+ws, JWT tickets, rate limits, replay, presence, drain) — 6 integration tests
- [x] packages/db (Drizzle, Better Auth tables via CLI, rooms + snapshots) · local Postgres via embedded-postgres
- [x] apps/web: Next 16 + Better Auth (email + anonymous guests), landing, sign-in/up, dashboard, live room (constellation, transcript, cards, approvals, mobile tabs), Web Speech mic
- [x] Playwright e2e with real models: sign-up → room → guest joins → fact-check → decision → approval → action, passing (35 s)
- [x] Persist room snapshots + recap page (copy as Markdown) · host-only end-meeting — e2e covers full lifecycle
- [x] Visual QA: dark/light, phone (390px) — screenshots in apps/web/e2e/.artifacts
- [x] Deploy prep: rooms Dockerfile + fly.toml, CI workflow, deploy runbook in SETUP.md §5
- [ ] Needs your accounts/keys: mem0 Memory Keeper (MEM0_API_KEY) · Deepgram STT · Mozaik Cloud (MOZAIK_API_KEY) · Neon/Fly/Vercel deploy
- [ ] Room→machine affinity for >1 room server (Redis + fly-replay)

Original checklist:
- [ ] apps/rooms: Fastify + ws gateway, JWT room tokens, zod protocol, reconnect w/ `lastSeq`
- [ ] apps/web: Next.js + Clerk + Drizzle/Neon; dashboard, create room, room link
- [ ] Deepgram streaming from browser (mic + tab audio via `getDisplayMedia`)
- [ ] Live Room UI v1: transcript · constellation (live loop phases) · cards
- [ ] mem0 Memory Keeper end-to-end (2 meetings, recall works)
- [ ] Deploy web (Vercel) + rooms (Fly) + Sentry; rate limits (Upstash)
- [ ] Design pass with UI-REFERENCES.md kits; landing page
- [ ] 29 Oct: watch Intro-to-Mozaik stream; note anything that changes plans

## Phase 3 — Hackathon (30–31 Oct)
### Fri — Kickoff
| Time | Task |
|---|---|
| K+0:00 | Read brief twice. Map it → room template + 1–2 domain agents. Write `BRIEF.md` (brief, mapping, judging cards). |
| K+0:45 | Update PRODUCT.md demo script for the brief. Cut list decided. |
| K+1:00 → K+6 | Build brief-specific agents + specs + interception |
| K+6 → K+10 | Brief-specific UI (cards, template, recap sections) |
| K+10 | Deploy. Full dry-run with real speech. Fix top 3 issues. |
| Night | Sleep ≥5h. Non-negotiable — solo demos die on no sleep. |
### Sat — Polish & submit
| Time | Task |
|---|---|
| AM | Reliability: reconnect, provider fallback, budget caps, error states, phone layout |
| Midday | Replay view + kaleidoskop export + Mozaik Cloud link |
| −4h | Feature freeze. README with architecture diagram & "How concurrency works" section |
| −3h | Record 3-min demo video (backup) |
| −2h | Rehearse live demo ×3 |
| −1h | Submit (repo, URL, video, Cloud link). Don't submit in the last 10 minutes. |

## Cut list (drop in this order if behind)
1. Linear/Slack integrations → keep "copy recap"
2. Replay scrubber → keep JSONL export
3. Room templates beyond the brief's one
4. Light theme polish
5. Researcher agent
**Never cut:** concurrent constellation, Fact-Checker, Devil's Advocate (state spec), interception approval, mem0 recall, deploy.

## Risks
| Risk | Mitigation |
|---|---|
| Mozaik 4.2 pushed at stream | Adapter layer; ask judges if 4.1 is fine (it's their stable release) |
| Brief doesn't fit "meetings" | Engine is generic "live stream → concurrent agents → cards"; transcript can be any stream (chat, logs, docs, sensor feed). Re-skin templates. |
| LLM latency on stage | Fast models for triage, streaming cards, pre-warmed connections |
| Venue Wi-Fi | Phone hotspot + recorded video |
| Cost blow-up | Per-room budget, semaphore, spend caps |
| Solo burnout | Plan is front-loaded before kickoff; sleep block |
