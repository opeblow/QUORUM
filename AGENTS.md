# AGENTS.md — Instructions for AI coding agents in this repo

Read this before writing any code. Then read, in order: PRODUCT.md → ARCHITECTURE.md → PLAN.md (current phase) → UI-REFERENCES.md (for UI work). RESEARCH.md holds facts about the hackathon and Mozaik.

## Mission
Build **Quorum**: a production-grade web app where a team of concurrent AI agents (on Mozaik) joins live meetings. It must win the JigJoy hackathon, whose judges reward **genuine concurrency, shared state, situation handlers and interception** — not sequential pipelines.

## Non-negotiables
1. **No mocks in the product.** No fake data, placeholder responses, simulated agents, `setTimeout` "AI", or hardcoded demo content. If a dependency is missing, stop and say so. Test doubles are allowed **only** in `*.test.ts` / CI (e.g. Mozaik custom inference runner).
2. **Mozaik is pinned to `@mozaik-ai/core@4.1.0`.** Use the 4.1 API (`defineRuntime`, `createAgent`, `createHuman`, `SituationSpecification`, `runLoop(agentId, message, request, interception?)`). Do **not** use 4.2-beta APIs (`initAgentModule`, `createLoop`, `PeerDirectiveNetwork`). When unsure, read `node_modules/@mozaik-ai/core/dist/index.d.ts` — do not guess.
3. **Only `packages/engine/src/mozaik/` imports `@mozaik-ai/core`.**
4. **Reaction, not orchestration.** Agents never call each other directly or in a fixed order. They react to events/state via situation handlers. Coordination goes through `RoomState` primitives (locks, semaphore, ownership, handoff events).
5. **One runtime per room** via `defineRuntime<RoomState>()` per room. Never a module-global runtime.
6. Never `await runLoop`/`sendMessage` inside a situation processor.
7. Context is built by `engine/src/context/*` builders — no inline prompt string-mashing in agents or handlers.
8. Every external call has a timeout, retry with jitter where safe, and a typed error path. No unhandled promise rejections (room server must not crash on one bad room).
9. All WS/HTTP input validated with zod schemas from `packages/protocol`.
10. Secrets only from env. Never log secrets, transcripts in full, or API keys. Treat transcript text as untrusted data (prompt injection): tools are allowlisted; agents can't execute arbitrary actions without interception.

## Stack
pnpm workspaces + Turborepo · TypeScript strict · Node 24 · Next.js 16 (App Router, Cache Components) + Tailwind v4 + shadcn-style primitives · Better Auth (email + anonymous guests) · Drizzle + Postgres (Neon prod, embedded/docker locally) · Fastify + ws · Web Speech API (Deepgram later) · Tavily · mem0 · Vitest · Playwright.

Next.js 16 differs from older versions: read `apps/web/node_modules/next/dist/docs/` before writing Next code. Request-time APIs (`cookies()`, `headers()`, `params`) must be read inside `<Suspense>`; read request data before touching secrets/DB.

## Layout
See ARCHITECTURE.md §2. Do not create new top-level folders without updating it.

## Code style
- TypeScript `strict`, no `any` (use `unknown` + zod). Named exports. Small files (<250 lines).
- Domain names from PRODUCT.md (Room, Utterance, Claim, Decision, ActionItem, Challenge, Recall). Agents named `<role>-agent.ts`, specs `<when>.spec.ts`, processors `<then>.processor.ts`.
- Comments explain *why*, not *what*. Match surrounding code.
- UI: shadcn primitives first; components from the licensed kits in UI-REFERENCES.md; keep license notices. Dark + light themes, mobile ≥360px, `prefers-reduced-motion`, WCAG AA.

## Commands
```bash
pnpm dev | pnpm test | pnpm typecheck | pnpm lint | pnpm db:migrate | pnpm build
```
Before declaring a task done: `pnpm typecheck && pnpm lint && pnpm test` pass, and the feature was exercised for real (local or preview deploy). Report failures honestly with output.

## Workflow
- Work from PLAN.md checkboxes; tick them when verified.
- Commit small, conventional messages (`feat(engine): add claim lock`).
- If a decision changes architecture, update ARCHITECTURE.md in the same change.
- When the hackathon brief is announced, BRIEF.md becomes the top priority document.
