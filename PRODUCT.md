# PRODUCT.md — Quorum

> **A team of AI agents in every meeting — working at the same time as you.**
> (Working name. Alternatives: Roundtable, Huddle, Conclave.)

## 1. Problem
Meetings are where decisions happen and where they get lost. Today's AI note-takers (Granola, Otter, Fireflies…) are a **single model that summarizes**. They don't:
- catch a wrong number while it's being said,
- notice the room agreeing too fast,
- answer the question someone just asked,
- remember that this team decided the opposite three weeks ago,
- turn "I'll do it" into a real ticket with an owner.

## 2. Solution
Quorum puts a **team of specialist agents** in the meeting. They all listen to the same live transcript **concurrently**, each reacting on its own terms, coordinating through shared room state, and surfacing their work as live cards the humans can accept, dismiss or redirect.

## 3. Users
- **Primary:** product/engineering teams, founders, students in group projects — anyone who runs recurring meetings on Google Meet / Zoom (web) / in person.
- **Day-1 usable** by any person with a browser and a mic. No bot invites, no calendar integration required.

## 4. The agent team (v1 roster)

All agents are Mozaik participants in one per-room runtime. **None is called by another in sequence** — each has its own situation handlers.

| Agent | Wakes up when… (situation spec) | Does | Writes to shared state |
|---|---|---|---|
| **Scribe** | every finalized utterance window | Maintains topic outline + running summary | `topics`, `summary` |
| **Fact-Checker** | an utterance contains a checkable claim (number, date, named fact) **and** no one holds that claim's lock | Web search → verdict card (supported / disputed / false + source) | `claims[]` (locked by owner) |
| **Researcher** | a question is asked and not answered within ~10s | Researches and posts an answer card | `answers[]` |
| **Decision Tracker** | language of commitment ("let's go with", "agreed") | Records decision w/ rationale | `decisions[]` |
| **Action Owner** | "I'll…", "can you…", deadlines | Creates action item w/ owner + due; proposes external ticket (**interception → human approval**) | `actions[]` |
| **Devil's Advocate** | **state-based**: ≥3 agreement signals on a topic and 0 counterpoints in the window | Raises the strongest counter-argument | `challenges[]` |
| **Memory Keeper** (mem0) | a new decision/topic appears | Recalls past meetings; flags contradictions ("On 3 Oct you decided X") | `recalls[]` |
| **Moderator** (rules, not LLM) | budget/latency/conflict events | Enforces per-room LLM semaphore & budget; **intercepts other agents' loops** (e.g. pauses Action Owner if Fact-Checker just refuted the claim behind the action) | `budget`, `locks` |

Humans: every attendee who opens the room link joins as a Mozaik `Human` participant and can @-mention an agent ("@Researcher what's our churn?"), accept/dismiss cards, or approve intercepted actions.

Observers (no LLM): **Broadcaster** (streams events to UI), **Auditor** (JSONL audit log — kaleidoskop-compatible), **Persister** (Postgres).

## 5. Key experiences
1. **Start a room in 1 click** → share link → speak (mic) or capture a Meet/Zoom browser tab's audio.
2. **Live Room view**: transcript on the left, agent constellation in the center (each agent's live loop state: listening · thinking · calling tool · answering), cards stream on the right.
3. **Approvals inbox**: intercepted actions wait for a human: approve, edit or reject.
4. **After the meeting**: a clean recap (decisions, actions, verified claims, open questions) → copy / share link / push to Slack/Linear.
5. **Memory across meetings**: the next meeting of the same team starts with "Last time…" context.
6. **Replay**: scrub through the meeting and watch agents fire (and export JSONL to kaleidoskop).

## 6. Room templates (brief adaptability)
The roster is config, not code. At kickoff we map the brief onto a template + 1–2 domain agents:
Standup · Sales/Discovery call · Hiring interview · Lecture/Study group · Incident war-room · Brainstorm · Board/Investor update.

## 7. Why this wins (judging map)
| Judge expectation | Quorum |
|---|---|
| Genuine concurrency | 7+ agents react to the same stream simultaneously; visible in UI |
| Shared state & coordination | Typed `RoomState` with locks, semaphore, ownership, handoffs |
| Situation handlers | Event-based **and** state-based specs, composed with `.and/.or/.not` |
| Interception | Human approval **and** agent-to-agent interception |
| Awareness | Agents react to `participant.joined` (a new human → Scribe sends them a catch-up) |
| Adaptivity | Moderator throttles/reroutes under budget pressure; models downgrade gracefully |
| mem0 sponsor | Cross-meeting team memory is a core feature, not a checkbox |
| Visual run inspection | Live constellation + replay + Mozaik Cloud link + kaleidoskop export |
| Real product | Auth, persistence, rate limits, cost caps, deployed URL, works for anyone |

## 8. Demo script (3 minutes)
1. (0:00) Problem in one line. Open quorum app, create room, project it.
2. (0:20) Judges talk. Someone says a wrong stat → **Fact-Checker** card marked False with source within seconds, while **Scribe** and **Decision Tracker** update in parallel — constellation lights up multiple agents at once.
3. (1:00) Everyone agrees quickly → **Devil's Advocate** interjects (state-based trigger).
4. (1:30) "Ana will ship the fix by Friday" → **Action Owner** proposes a Linear ticket → **interception** asks a human to approve on a phone.
5. (2:00) Mention a past decision → **Memory Keeper** recalls the earlier meeting via mem0.
6. (2:30) End meeting → recap; open Mozaik Cloud live run link + kaleidoskop replay. Close: "Agents that work together — with you."

## 9. Non-goals (v1)
Native Zoom/Teams bots, calendar auto-join, speaker diarization perfection, mobile native apps, video.
