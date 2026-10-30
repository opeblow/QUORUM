# Privacy

Quorum is built so that people can trust the room. This document explains, in plain language, what is collected, why, and what you can do about it. It describes the software in this repository; whoever operates a deployment is the data controller and should publish its own policy based on this one.

## What we store

| Data | Why | Where |
|---|---|---|
| Account: name, email, hashed password | sign-in | Postgres |
| Guest: the name you enter | showing who's speaking | Postgres (anonymous account) |
| Meeting: title, transcript text, summary, decisions, action items, fact-checks, challenges, chat messages | the live meeting and its recap | Postgres (meeting snapshot) |
| Shared files | sharing in the meeting | Postgres (`room_files`), deleted with the meeting |
| Decisions and approved action items | team memory for later meetings | mem0, scoped to the meeting owner |

## What we don't store

- **Audio and video are never recorded or stored.** Calls are peer-to-peer between participants' browsers.
- **Speech is transcribed in your browser** (the browser's built-in recogniser); only the resulting text is sent to the room.
- No advertising, no tracking pixels, no sale of data.

## Processors

To do their work, the agents send **meeting text** (not audio) to:

- **AI model providers** (OpenAI, and optionally Anthropic or Google) — to analyse the conversation.
- **Tavily** — search queries derived from claims being fact-checked.
- **mem0** — decisions and approved action items, for team memory.
- **Mozaik Cloud** (optional) — agent run telemetry, with redaction enabled.

Each is used under its API terms; configure enterprise/zero-retention options where available for sensitive deployments. Browser speech recognition in Chrome/Edge is provided by the browser vendor.

## Consent and transparency

- Everyone joining sees that what they say is transcribed and shared with the room.
- Agents never act on anyone's behalf without an explicit human approval in the room.
- Fact-checks show their sources.

## Your rights

You can ask the operator of a deployment to access, correct, export or delete your data. Deleting a meeting deletes its snapshot and files; deleting an account deletes its rooms. These rights align with Nigeria's NDPA 2023, Kenya's Data Protection Act 2019, South Africa's POPIA, Ghana's Data Protection Act 2012, and the EU GDPR.

## Children

Quorum is not intended for children under 13.

## Changes

Changes to this document are tracked in this repository's history.
