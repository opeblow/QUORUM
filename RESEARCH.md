# RESEARCH.md — Hackathon intel & Mozaik findings

Last updated: 2026-10-18. Re-verify anything marked (unconfirmed) before relying on it.

## 1. The hackathon

| Item | Fact |
|---|---|
| Name | JigJoy × NTP Novi Sad Hackathon 2026 — "Build agents that work together" |
| URL | https://jigjoy.ai/hackathon-2026 |
| Required tech | **Mozaik** (`@mozaik-ai/core`), JigJoy's open-source TS runtime for concurrent agents |
| Theme | A system of AI agents that **run concurrently, share state and coordinate** — *not* a fixed sequential handoff |
| Brief | One open brief, **announced at kickoff**. No tracks. |
| Judging signal | "Weight on genuine use of concurrency: agents that actually run together, not a sequential pipeline in disguise." Full judging cards published before the event (unconfirmed) |
| Team | Solo or up to 4. We are **solo**. |
| Format | On-site (NTP Novi Sad, Fruškogorska 1) or online — same schedule & jury |
| Prizes | $500 / $300 / $200 · 5× Mozaik Cloud Premium (6 mo) · 3× two-week JigJoy internships (in-person) |
| Sponsor | **mem0** (memory layer) · Partners: NTP Novi Sad, EINSTEIN project · Community: Beaver |

### Dates
| Date | Event |
|---|---|
| **27 Oct** | Registration closes — **register before this** |
| 29 Oct | Multi-hour "Intro to Mozaik" stream — watch it, they may push 4.2 (unconfirmed) |
| **30 Oct (Fri)** | Kickoff + brief |
| **31 Oct (Sat)** | Submissions close (page says "48h" but Fri→Sat is ~36h — confirm exact times in the schedule email (unconfirmed)) |
| 7 Nov | Winners announced |

### Unknowns to resolve (ask on Discord: https://discord.gg/dvxY9J2kWX)
- Unconfirmed: Is code written **before** kickoff allowed? (Our plan assumes: generic scaffolding/infra/UI kit OK; brief-specific features built during the event.)
- Unconfirmed: Submission format (repo? video? live URL?)
- Unconfirmed: Exact judging weights.

## 2. The judges — what they value

Core judges are the **JigJoy co-founders** — they built Mozaik:
- **Miodrag Vilotijević** (GitHub: `Mijura`) — co-founder/CEO, author of `@mozaik-ai/core`.
- **Miodrag Todorović** — co-founder.
- Also listed: Petar Ćirković, Aleksandar Hadžibabić, Kishan Sharma, Milan Vasić, Vladimir Hristov (no public AI profile found).

What their own writing and code tell us they reward:

| They value | Evidence | How we show it |
|---|---|---|
| Real concurrency, not pipelines | Hackathon page | Many agents react to one live event stream in parallel |
| **Concurrency · Awareness · Adaptivity** | README's three core attributes | Parallel loops; agents react to joins/answers of others; runtime rerouting |
| Reaction over orchestration | README: "Behaviors compose by reaction, not orchestration" | No central controller calling agents in order — every agent has its own situation handlers |
| Situation handlers + interception (v4 headline features) | v4.0.0 release notes | State-based triggers + **agent-to-agent** interception, not only human approval |
| Shared state w/ locks, semaphores, ownership, handoffs | v4.0.0 release notes | Claim locks, per-room LLM semaphore, owned artifacts, explicit handoffs |
| Context as a first-class primitive; dislikes "anemic domain models" & context logic leaking into business code | Vilotijević, DEV.to "Why Agent Frameworks End Up As SDK Wrappers" | Clean domain layer; context built by dedicated builders, never inline |
| Visualizing agent runs | They built **kaleidoskop** (hexagon "neural network" replay) and Mozaik Cloud live run links | Stunning live "room" view + kaleidoskop-compatible JSONL export + Mozaik Cloud link |
| Humans as first-class participants | `createHuman`, human-in-the-loop examples | Meeting attendees are real `Human` participants in the runtime |
| Conway's law / team structure | JigJoy blog "Structure Shapes Success" | Agents modelled as a team with roles and ownership |

**Do not** clone **baro** (their flagship: concurrent coding agents → PR). Judges would compare it against their own tool.

## 3. Mozaik — version findings (critical)

- npm `latest` dist-tag = **`4.2.0-beta.18`** (6 Oct 2026). On `main`, this is a **rewrite**: `defineRuntime`, situation handlers and participants are gone; replaced by `initAgentModule` / `createLoop` / `runLoop(loopId)`, peers, directives and a `PeerDirectiveNetwork`. It also bundles a `Mem0Factory` memory adapter. It is **unstable and undocumented**.
- **`4.1.0`** (2 Oct 2026) = the API documented in the README and docs.jigjoy.ai. Starter template + all 12 examples pin `^4.0.5`.
- **Decision: pin `@mozaik-ai/core@4.1.0` exactly** and isolate it behind our own adapter (`packages/engine`), so a switch to 4.2 later only touches the adapter.
- `defineRuntime()` returns a fresh closure every call (`let runtime = null` inside) → **one isolated runtime per meeting room** is possible. Each room calls `defineRuntime<RoomState>()` itself.
- `runLoop` is fire-and-forget; event fan-out is synchronous and does not await processors.
- Mozaik Cloud is enabled by `@mozaik-ai/cloud-sdk` env: `MOZAIK_CLOUD_ENDPOINT`, `MOZAIK_CREDENTIALS_FILE`, `MOZAIK_REDACTION`. It sends agent memory/instructions → use redaction in prod.
- Supported models in 4.1.0 include: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5`, `claude-fable-5-1`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-6-*`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `deepseek-v4-*`.
- Locks/semaphores are **not** built-in exports in 4.1.0 — we implement them on our `RuntimeState` subclass (that is the intended pattern).

### Runtime behaviours found while building (4.1.0) — and how we handle them
These are worth raising with the judges (and as upstream issues/PRs) — it shows we read their code.
| Behaviour | Consequence | Our handling |
|---|---|---|
| `runLoop` doesn't await/catch `agentLoop.run()` | Any provider error → unhandled rejection → Node exits | `ResilientInferenceRunner` never throws; ends loops with a "failed" signal message. `installProcessGuards()` as safety net |
| `EventProcessor` calls handlers without try/catch | One throwing handler stops delivery to the rest | Every handler wrapped by `safeHandler()` |
| `ModelContext.addContextItems` mutates in place | Reusing `agent.getMemory().getContext()` grows forever | Fresh `ModelContext` per loop, curated by context builders |
| Only the **first** `function_call` per inference is executed | Parallel tool calls silently dropped | Instruction: "call at most one tool at a time" |
| Loop throws if a response has neither message nor tool call | Unhandled rejection | Runner validates output and retries |
| Anthropic mapper always sends `max_tokens` from `maxOutputTokens` | Missing value → API error | Every agent declares `maxOutputTokens` |
| `InferenceInputValidator` not exported | Can't build `DefaultInferenceRunner` with validation | Take the runner from a throwaway runtime (`default-runner.ts`) |
| `Tool` exported, `FunctionTool` not | — | Import `Tool` |
| Interception can't return `idle` | No direct "stop" | Rewrite to `model_message` with an "aborted" signal answer |

## 4. Ecosystem repos (cloned for reference in session scratchpad; re-clone with `git clone --depth 1`)
- `jigjoy-ai/mozaik` — runtime
- `jigjoy-ai/mozaik-examples` — 12 examples (terminal-agent, inference-interception, human-in-the-loop, history-simulation, streaming, tool-calling, structured-output, shared-state, reasoning-effort, custom-inference-runner, mcp, wrong-answer)
- `jigjoy-ai/cli-agent-starter` — official starter template
- `jigjoy-ai/baro` — flagship concurrent coding-agent CLI
- `jigjoy-ai/kaleidoskop` — replay visualizer (Fastify + WS backend, Vite/React/Tailwind v4 frontend), live at kaleidoskop.jigjoy.ai, consumes JSONL audit logs

## 5. Competitive landscape for our product
Granola, Otter, Fireflies, Fathom, Read.ai, tl;dv — all are essentially **one model summarizing after/alongside** the meeting. None run a **team of concurrent agents that act during the meeting**, check facts live, challenge groupthink, and remember decisions across meetings. That is our wedge.
