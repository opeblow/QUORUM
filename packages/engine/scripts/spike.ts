/**
 * Phase-1 spike: real models, real web search, real runtime — in the terminal.
 *
 *   pnpm spike                               interactive: type "Name: what they said"
 *   pnpm spike --file samples/standup.txt    replay a transcript at speaking pace
 *   pnpm spike --file … --rooms 2            same input into 2 isolated rooms at once
 *   --approver auto-approve|auto-reject      who decides approvals in file mode (default: you)
 *   --pace 1.0                               replay speed multiplier
 *
 * In interactive mode: "/approve <id> [note]", "/reject <id> [note]", "/state", "/quit".
 */
import { config as loadEnv } from "dotenv"
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import {
	createRoom,
	defaultRoster,
	installProcessGuards,
	planModels,
	RoomEvents,
	toAuditLine,
	type Room,
	type RoomEvent,
	type RoomEventPayloads,
} from "../src/index"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../..")
// .env.local overrides .env (dotenv never overwrites a variable that is already set).
loadEnv({ path: [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")], quiet: true })

const { values } = parseArgs({
	options: {
		file: { type: "string" },
		rooms: { type: "string", default: "1" },
		approver: { type: "string" },
		pace: { type: "string", default: "1" },
	},
})

const c = {
	dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
	bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
	color: (code: number, s: string) => `\x1b[38;5;${code}m${s}\x1b[0m`,
}
const AGENT_COLORS: Record<string, number> = {
	Scribe: 250,
	"Fact-Checker": 42,
	"Decision Tracker": 141,
	"Action Owner": 214,
	"Devil's Advocate": 204,
	Moderator: 244,
}

installProcessGuards()

// The Mozaik Cloud SDK warns once per loop when MOZAIK_API_KEY is unset; show it once.
const seenWarnings = new Set<string>()
const warn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
	const key = args.map(String).join(" ")
	if (seenWarnings.has(key)) return
	seenWarnings.add(key)
	warn(...args)
}

const models = (() => {
	try {
		return planModels(process.env)
	} catch (error) {
		console.error(`\x1b[31m${(error as Error).message}\x1b[0m\nAdd keys to ${resolve(repoRoot, ".env.local")} (see .env.example).`)
		process.exit(1)
	}
})()
const roster = defaultRoster({ tavilyApiKey: process.env.TAVILY_API_KEY })
const roomCount = Math.max(1, Math.min(8, Number(values.rooms) || 1))
const pace = Math.max(0.1, Number(values.pace) || 1)

console.log(c.bold("Quorum engine spike"))
console.log(c.dim(`models fast=${models.fast.join(" → ")}  smart=${models.smart.join(" → ")}`))
for (const d of roster.disabled) console.log(c.color(214, `! ${d.name} disabled: ${d.reason}`))

mkdirSync(resolve(repoRoot, ".audit"), { recursive: true })
const startedAt = Date.now()

const rooms: Room[] = Array.from({ length: roomCount }, (_, i) => {
	const roomId = `spike-${startedAt}-${i + 1}`
	const room = createRoom({
		roomId,
		agents: roster.agents,
		models,
		// Measured ~15k tokens per meeting-minute with the full roster; this covers ~45-90 minutes.
		budget: { softTokens: 700_000, hardTokens: 1_400_000 },
		maxConcurrentLoops: 4,
	})
	const audit = createWriteStream(resolve(repoRoot, ".audit", `${roomId}.jsonl`), { flags: "a" })
	room.onEvent((event) => {
		const line = toAuditLine(event, room.nameOf)
		if (line) audit.write(`${JSON.stringify(line)}\n`)
		print(roomCount > 1 ? `[room ${i + 1}] ` : "", event, room.nameOf)
	})
	return room
})

function print(prefix: string, event: RoomEvent, nameOf: (id: string) => string): void {
	const who = nameOf(event.producerId)
	const tag = (s: string) => c.color(AGENT_COLORS[who] ?? 75, s)
	const t = c.dim(`${((Date.now() - startedAt) / 1000).toFixed(1).padStart(6)}s`)
	const out = (s: string) => console.log(`${t} ${prefix}${s}`)
	switch (event.type) {
		case RoomEvents.utteranceFinal: {
			const { utterance } = event.payload as RoomEventPayloads["utterance.final"]
			return out(`${c.bold(utterance.speakerName)}: ${utterance.text}`)
		}
		case RoomEvents.agentPhase: {
			const { phase, detail } = event.payload as RoomEventPayloads["agent.phase"]
			if (phase === "listening") return
			return out(tag(`  ◦ ${who} ${phase}${detail ? c.dim(` (${detail})`) : ""}`))
		}
		case RoomEvents.claimResolved: {
			const { claim } = event.payload as RoomEventPayloads["claim.resolved"]
			if (claim.status === "dismissed") return
			const icon = { supported: "[supported]", disputed: "[disputed]", refuted: "[false]", unverifiable: "[unverifiable]", failed: "[failed]", checking: "[checking]" }[claim.status]
			out(tag(`${icon} FACT "${claim.text}" — ${claim.verdict ?? ""}`))
			if (claim.correction) out(tag(`   correction: ${claim.correction}`))
			for (const s of claim.sources) out(c.dim(`   ${s.url}`))
			return
		}
		case RoomEvents.decisionRecorded: {
			const { decision } = event.payload as RoomEventPayloads["decision.recorded"]
			return out(tag(`◆ DECISION ${decision.text}${decision.rationale ? c.dim(` — ${decision.rationale}`) : ""}`))
		}
		case RoomEvents.approvalRequested: {
			const { request } = event.payload as RoomEventPayloads["approval.requested"]
			out(tag(`APPROVAL ${c.bold(request.id)}: ${request.summary}`))
			return autoDecide(request.id)
		}
		case RoomEvents.actionDecided: {
			const { action } = event.payload as RoomEventPayloads["action.decided"]
			return out(tag(`ACTION [${action.status} by ${action.decidedBy}] ${action.assignee}: ${action.task}${action.due ? ` — ${action.due}` : ""}`))
		}
		case RoomEvents.challengeRaised: {
			const { challenge } = event.payload as RoomEventPayloads["challenge.raised"]
			return out(tag(`CHALLENGE (${challenge.topic}) ${challenge.argument} ${c.bold(challenge.question)}`))
		}
		case RoomEvents.summaryUpdated: {
			const { summary } = event.payload as RoomEventPayloads["summary.updated"]
			return out(tag(`≡ SUMMARY ${summary.text} ${c.dim(`[${summary.topics.join(" · ")}]`)}`))
		}
		case RoomEvents.budgetPressure:
			return out(c.color(214, `$ budget ${(event.payload as RoomEventPayloads["budget.pressure"]).pressure}`))
		case RoomEvents.agentFailed:
			return out(c.color(196, `FAILED ${who}: ${(event.payload as RoomEventPayloads["agent.failed"]).reason}`))
		case RoomEvents.agentSkipped:
			return out(c.dim(`  ${who} skipped: ${(event.payload as RoomEventPayloads["agent.skipped"]).reason}`))
	}
}

const host = { id: "host", name: "You" }

function autoDecide(id: string): void {
	const mode = values.approver
	if (mode !== "auto-approve" && mode !== "auto-reject") return
	// Small delay so the pause is visible, as it would be for a person.
	setTimeout(() => {
		for (const room of rooms) room.decide(id, mode === "auto-approve", host, "auto-decided by spike")
	}, 1500).unref()
}

function say(line: string): void {
	const match = /^([^:]{1,40}):\s*(.+)$/u.exec(line.trim())
	if (!match) return console.log(c.dim('  format: "Name: what they said"'))
	const [, name, text] = match as unknown as [string, string, string]
	const speaker = { id: name.toLowerCase(), name: name.trim() }
	for (const room of rooms) room.say(speaker, text)
}

function report(): void {
	for (const room of rooms) {
		const s = room.snapshot()
		const u = room.usage()
		console.log(c.bold(`\n── ${room.id}`))
		console.log(`utterances ${s.utterances.length} · claims ${s.claims.filter((x) => x.status !== "dismissed").length} · decisions ${s.decisions.length} · actions ${s.actions.length} · challenges ${s.challenges.length}`)
		console.log(`tokens in ${u.inputTokens} / out ${u.outputTokens} · pressure ${u.pressure}`)
		console.log(c.dim(`audit log: .audit/${room.id}.jsonl`))
	}
}

async function waitForIdle(timeoutMs = 120_000): Promise<void> {
	const deadline = Date.now() + timeoutMs
	const busy = () => rooms.some((r) => r.agents().some((a) => a.phase !== "listening" && a.phase !== "degraded") || r.openApprovals().length > 0)
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 500))
		if (!busy()) return
	}
}

/** pnpm --filter runs us inside packages/engine; resolve paths from where the user typed the command. */
function resolveInput(path: string): string {
	const candidates = [process.env.INIT_CWD, process.cwd(), repoRoot]
		.filter((base): base is string => Boolean(base))
		.map((base) => resolve(base, path))
	const found = candidates.find((p) => existsSync(p))
	if (!found) {
		console.error(`\x1b[31mTranscript not found: ${path}\x1b[0m\nLooked in:\n${candidates.map((p) => `  ${p}`).join("\n")}`)
		process.exit(1)
	}
	return found
}

async function replay(path: string): Promise<void> {
	const lines = readFileSync(path, "utf8")
		.split(/\r?\n/u)
		.filter((l) => l.trim() && !l.startsWith("#"))
	for (const line of lines) {
		say(line)
		// Roughly speaking pace: ~160 words per minute.
		const words = line.split(/\s+/u).length
		await new Promise((r) => setTimeout(r, (words / 160) * 60_000 / pace))
	}
	console.log(c.dim("\n(transcript finished — waiting for agents to settle)"))
	await waitForIdle()
}

async function interactive(): Promise<void> {
	const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
	console.log(c.dim('Type "Name: text". Commands: /approve <id> [note] · /reject <id> [note] · /state · /quit'))
	for await (const line of rl) {
		const [cmd, id, ...rest] = line.trim().split(/\s+/u)
		if (cmd === "/quit") break
		if (cmd === "/state") report()
		else if ((cmd === "/approve" || cmd === "/reject") && id) {
			for (const room of rooms) room.decide(id, cmd === "/approve", host, rest.join(" ") || undefined)
		} else say(line)
	}
	rl.close()
}

const transcriptPath = values.file ? resolveInput(values.file) : null

try {
	if (transcriptPath) await replay(transcriptPath)
	else await interactive()
} finally {
	report()
	for (const room of rooms) room.close()
}
