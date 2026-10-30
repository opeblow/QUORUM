# Contributing to Quorum

Thank you for helping build meetings that think — for Africa and the world. All contributions are welcome: code, translations, accessibility fixes, docs and bug reports.

## Ground rules

- Be kind. We follow our [Code of Conduct](CODE_OF_CONDUCT.md).
- Security issues go to [SECURITY.md](SECURITY.md), **never** a public issue.
- No mock data or fake behaviour in the product. Test doubles belong only in tests.

## Setup

```bash
pnpm install
cp .env.example .env.local     # add at least one model key; see README → Configuration
pnpm db:local                  # local Postgres on :54329 (or point DATABASE_URL at Neon)
pnpm db:migrate
pnpm --filter @quorum/rooms dev
pnpm --filter @quorum/web dev
```

## Before you open a pull request

```bash
pnpm --filter @quorum/web typecheck
pnpm --filter @quorum/engine test
pnpm --filter @quorum/rooms test
pnpm e2e        # needs web + rooms + database running; spends a few cents of model usage
```

All must pass. Include tests for new behaviour.

## Conventions

- **TypeScript strict**, no `any` — use `unknown` + zod at boundaries.
- **Mozaik stays behind `packages/engine/src/mozaik/`.** Nothing else imports `@mozaik-ai/core`.
- **Agents react, they don't orchestrate.** New agents are `AgentDefinition`s with `select → begin → prompt → output → finish`; coordinate through `RoomState`, never by calling each other.
- **Wire changes start in `packages/protocol`.** Never send prompts, provider responses or secrets to the browser.
- **Next.js 16:** read `apps/web/node_modules/next/dist/docs/` before writing Next code; request-time APIs live inside `<Suspense>`.
- Comments explain *why*. Keep files small and names domain-specific (Room, Claim, Decision, ActionItem…).
- Commits: conventional style — `feat(engine): …`, `fix(web): …`, `docs: …`.

## Good first contributions

- Add a speech language in `apps/web/src/lib/languages.ts` (with a native speaker's check).
- Improve an agent's instruction and add a regression test from a real transcript.
- Accessibility: keyboard paths, screen-reader labels, contrast.
- Translate the UI.

## Adding an agent

1. Create `packages/engine/src/agents/<name>.ts` with `defineAgent(...)`.
2. Decide its trigger (`select`) — prefer cheap deterministic triage before any model call.
3. Give it a zod output schema; update shared state only in `finish`.
4. Add it to `defaultRoster`, the wire mapping (`apps/rooms/src/wire.ts`) and a card in `apps/web`.
5. Test with the scripted runner (see `packages/engine/test/room.integration.test.ts`).
