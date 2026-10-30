/**
 * Capacity test for the realtime layer: real server, real WebSockets, real engine runtime.
 * The model provider is a scripted stand-in so we measure our system, not an LLM's latency.
 *
 *   pnpm --filter @quorum/rooms exec tsx scripts/loadtest.ts [rooms=200] [clientsPerRoom=5] [seconds=30]
 */
import { monitorEventLoopDelay } from "node:perf_hooks"
import {
	InputTokenDetails,
	ModelMessageItem,
	OutputTokenDetails,
	TokenUsage,
	type InferenceOutput,
	type InferenceRunner,
} from "@mozaik-ai/core"
import { createRoom, decisionTracker, dedupeConsoleWarnings, scribe } from "@quorum/engine"
import { PROTOCOL_VERSION } from "@quorum/protocol"
import { SignJWT } from "jose"
import pino from "pino"
import { WebSocket } from "ws"
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from "../src/auth"
import { loadConfig } from "../src/config"
import { buildServer } from "../src/server"

const ROOMS = Number(process.argv[2] ?? 200)
const PER_ROOM = Number(process.argv[3] ?? 5)
const SECONDS = Number(process.argv[4] ?? 30)
const SECRET = "loadtest-secret-loadtest-secret-loadtest-secret"

class ScriptedRunner implements InferenceRunner {
	async run(): Promise<InferenceOutput> {
		await new Promise((r) => setTimeout(r, 800)) // typical fast-model latency
		return {
			items: [ModelMessageItem.rehydrate({ text: JSON.stringify({ summary: "s", topics: ["t"], decisions: [] }) })],
			tokenUsage: new TokenUsage(400, 60, 460, new InputTokenDetails(0), new OutputTokenDetails(0)),
			rowResponse: null,
		}
	}
	// eslint-disable-next-line require-yield
	async *stream(): AsyncGenerator<never> {
		throw new Error("unused")
	}
}

dedupeConsoleWarnings()

const server = await buildServer({
	config: loadConfig({ NODE_ENV: "test", ROOMS_JWT_SECRET: SECRET, PORT: "0", MAX_ROOMS: String(ROOMS + 10) }),
	logger: pino({ level: "silent" }),
	roomFactory: (roomId) =>
		createRoom({
			roomId,
			agents: [scribe, decisionTracker],
			models: { fast: ["claude-haiku-4-5"], smart: ["claude-sonnet-5-5"] },
			budget: { softTokens: 1e9, hardTokens: 2e9 },
			inferenceRunner: new ScriptedRunner(),
		}),
})
const address = await server.app.listen({ host: "127.0.0.1", port: 0 })
const url = `${address.replace("http", "ws")}/ws`

const ticket = (sub: string, roomId: string) =>
	new SignJWT({ name: sub, roomId, role: "guest", template: "default" })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(sub)
		.setIssuer(TOKEN_ISSUER)
		.setAudience(TOKEN_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime("10m")
		.sign(new TextEncoder().encode(SECRET))

const latencies: number[] = []
const sentAt = new Map<string, number>()
let received = 0

async function connect(roomId: string, sub: string): Promise<WebSocket> {
	const ws = new WebSocket(url, { headers: { origin: "http://localhost:3000" } })
	await new Promise<void>((res, rej) => {
		ws.once("open", () => res())
		ws.once("error", rej)
	})
	ws.on("message", (raw) => {
		// Load client: plain JSON, no schema validation, to keep generator overhead off the measurement.
		const m = JSON.parse(raw.toString()) as { type: string; event?: { type: string; utterance: { text: string } } }
		if (m.type === "event" && m.event?.type === "utterance") {
			received++
			const t = sentAt.get(m.event.utterance.text)
			if (t) latencies.push(performance.now() - t)
		}
	})
	ws.send(JSON.stringify({ type: "hello", protocol: PROTOCOL_VERSION, token: await ticket(sub, roomId), lastSeq: null }))
	return ws
}

const loop = monitorEventLoopDelay({ resolution: 10 })
loop.enable()
const t0 = performance.now()
const rooms: WebSocket[][] = []
for (let r = 0; r < ROOMS; r++) {
	const clients = await Promise.all(Array.from({ length: PER_ROOM }, (_, c) => connect(`load${r}`, `u${r}_${c}`)))
	rooms.push(clients)
}
console.log(`connected ${ROOMS * PER_ROOM} sockets in ${Math.round(performance.now() - t0)} ms`)

let n = 0
const speak = setInterval(() => {
	// Real rooms don't speak in lockstep: spread each room's line across the 2 s window.
	const tick = n
	for (const [r, clients] of rooms.entries()) {
		setTimeout(() => {
			const speaker = clients[tick % clients.length]!
			const text = `r${r} line ${tick} let's go with option ${tick}`
			sentAt.set(text, performance.now())
			speaker.send(JSON.stringify({ type: "say", text }))
		}, (r * 2000) / rooms.length)
	}
	n++
}, 2000)

await new Promise((r) => setTimeout(r, SECONDS * 1000))
clearInterval(speak)
await new Promise((r) => setTimeout(r, 2000))

latencies.sort((a, b) => a - b)
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]?.toFixed(1)
const mem = process.memoryUsage()
console.log(
	JSON.stringify(
		{
			rooms: ROOMS,
			socketsTotal: ROOMS * PER_ROOM,
			utterancesSent: ROOMS * n,
			deliveries: received,
			fanoutLatencyMs: { p50: pct(50), p95: pct(95), p99: pct(99) },
			eventLoopDelayMs: { p50: (loop.percentile(50) / 1e6).toFixed(1), p99: (loop.percentile(99) / 1e6).toFixed(1) },
			rssMB: Math.round(mem.rss / 1e6),
			heapUsedMB: Math.round(mem.heapUsed / 1e6),
		},
		null,
		2,
	),
)
for (const clients of rooms) for (const ws of clients) ws.close()
await server.drain("load test done")
process.exit(0)
