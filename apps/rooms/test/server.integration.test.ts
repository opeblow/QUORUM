/**
 * Real HTTP server, real WebSockets, real JWTs, real engine runtime.
 * Only the model provider is scripted (CI test double).
 */
import {
	InputTokenDetails,
	ModelMessageItem,
	OutputTokenDetails,
	TokenUsage,
	type InferenceInput,
	type InferenceOutput,
	type InferenceRunner,
} from "@mozaik-ai/core"
import { createRoom, decisionTracker } from "@quorum/engine"
import { PROTOCOL_VERSION, ServerMessage, type ClientMessage } from "@quorum/protocol"
import { SignJWT } from "jose"
import pino from "pino"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { WebSocket } from "ws"
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from "../src/auth"
import { loadConfig } from "../src/config"
import type { RoomStorePort } from "../src/persistence"
import { buildServer, type RoomServer } from "../src/server"

const SECRET = "test-secret-that-is-long-enough-for-hs256-0123456789"

class ScriptedRunner implements InferenceRunner {
	async run(_input: InferenceInput): Promise<InferenceOutput> {
		await new Promise((r) => setTimeout(r, 10))
		return {
			items: [ModelMessageItem.rehydrate({ text: JSON.stringify({ decisions: [{ text: "Ship on Friday", rationale: "" }] }) })],
			tokenUsage: new TokenUsage(50, 10, 60, new InputTokenDetails(0), new OutputTokenDetails(0)),
			rowResponse: null,
		}
	}
	// eslint-disable-next-line require-yield
	async *stream(): AsyncGenerator<never> {
		throw new Error("not scripted")
	}
}

let server: RoomServer
let url: string

/** Records what the server persists (test double for Postgres). */
const saved = new Map<string, { snapshots: number; lastDecisions: number; ended: boolean }>()
const recordingStore: RoomStorePort = {
	async saveSnapshot(roomId, view) {
		const entry = saved.get(roomId) ?? { snapshots: 0, lastDecisions: 0, ended: false }
		entry.snapshots++
		entry.lastDecisions = view.decisions.length
		saved.set(roomId, entry)
	},
	async markEnded(roomId) {
		const entry = saved.get(roomId) ?? { snapshots: 0, lastDecisions: 0, ended: false }
		entry.ended = true
		saved.set(roomId, entry)
	},
}

beforeAll(async () => {
	const config = loadConfig({ NODE_ENV: "test", ROOMS_JWT_SECRET: SECRET, PORT: "0" })
	server = await buildServer({
		config,
		logger: pino({ level: "silent" }),
		store: recordingStore,
		roomFactory: (roomId) =>
			createRoom({
				roomId,
				agents: [decisionTracker],
				models: { fast: ["claude-haiku-4-5"], smart: ["claude-sonnet-5-5"] },
				budget: { softTokens: 1e6, hardTokens: 2e6 },
				inferenceRunner: new ScriptedRunner(),
			}),
	})
	const address = await server.app.listen({ host: "127.0.0.1", port: 0 })
	url = `${address.replace("http", "ws")}/ws`
})

afterAll(async () => {
	await server.drain("test over")
})

async function token(claims: { sub: string; name: string; roomId: string; role?: "host" | "guest" }, ttl = "5m") {
	return new SignJWT({ name: claims.name, roomId: claims.roomId, role: claims.role ?? "guest", template: "default" })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(claims.sub)
		.setIssuer(TOKEN_ISSUER)
		.setAudience(TOKEN_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(ttl)
		.sign(new TextEncoder().encode(SECRET))
}

/** Minimal test client: collects parsed server messages and lets tests await specific ones. */
class TestClient {
	readonly messages: ServerMessage[] = []
	closeCode: number | null = null
	private waiters: Array<() => void> = []
	private constructor(readonly ws: WebSocket) {
		ws.on("message", (raw) => {
			this.messages.push(ServerMessage.parse(JSON.parse(raw.toString())))
			for (const w of this.waiters.splice(0)) w()
		})
		ws.on("close", (code) => {
			this.closeCode = code
			for (const w of this.waiters.splice(0)) w()
		})
	}

	static open(origin = "http://localhost:3000"): Promise<TestClient> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(url, { headers: { origin } })
			const client = new TestClient(ws)
			ws.once("open", () => resolve(client))
			ws.once("error", reject)
		})
	}

	send(message: ClientMessage | Record<string, unknown>): void {
		this.ws.send(JSON.stringify(message))
	}

	async waitFor<T extends ServerMessage>(predicate: (m: ServerMessage) => m is T, timeoutMs = 3000): Promise<T> {
		const deadline = Date.now() + timeoutMs
		for (;;) {
			const found = this.messages.find(predicate)
			if (found) return found
			if (Date.now() > deadline) throw new Error(`timed out; got ${JSON.stringify(this.messages.map((m) => m.type))}`)
			await new Promise<void>((r) => {
				this.waiters.push(r)
				setTimeout(r, 50)
			})
		}
	}

	get lastSeq(): number {
		return Math.max(0, ...this.messages.map((m) => (m.type === "event" ? m.seq : m.type === "welcome" ? m.seq : 0)))
	}
}

const isWelcome = (m: ServerMessage): m is Extract<ServerMessage, { type: "welcome" }> => m.type === "welcome"
const isError = (m: ServerMessage): m is Extract<ServerMessage, { type: "error" }> => m.type === "error"
const eventOf =
	<K extends string>(kind: K) =>
	(m: ServerMessage): m is Extract<ServerMessage, { type: "event" }> =>
		m.type === "event" && m.event.type === kind

describe("room server", () => {
	it("rejects sockets from origins that are not allowed", async () => {
		await expect(TestClient.open("https://evil.example")).rejects.toThrow(/403/)
	})

	it("rejects invalid tokens", async () => {
		const c = await TestClient.open()
		c.send({ type: "hello", protocol: PROTOCOL_VERSION, token: "not-a-real-token-at-all", lastSeq: null })
		const error = await c.waitFor(isError)
		expect(error).toMatchObject({ code: "unauthorized", fatal: true })
		await c.waitFor((m): m is ServerMessage => c.closeCode !== null || m.type === "pong")
	})

	it("streams agent work to every participant, with presence", async () => {
		const ana = await TestClient.open()
		ana.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_ana", name: "Ana", roomId: "r1", role: "host" }), lastSeq: null })
		const welcome = await ana.waitFor(isWelcome)
		expect(welcome.mode).toBe("snapshot")
		expect(welcome.snapshot?.agents.map((a) => a.role)).toEqual(["decision_tracker"])

		const bo = await TestClient.open()
		bo.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_bo", name: "Bo", roomId: "r1" }), lastSeq: null })
		await bo.waitFor(isWelcome)

		ana.send({ type: "say", text: "Okay, let's go with shipping on Friday." })
		for (const c of [ana, bo]) {
			const utterance = await c.waitFor(eventOf("utterance"))
			expect(utterance.event).toMatchObject({ utterance: { speakerName: "Ana", speakerId: expect.any(String) } })
			const decision = await c.waitFor(eventOf("decision"))
			expect(decision.event).toMatchObject({ decision: { text: "Ship on Friday" } })
		}
		const presence = ana.messages.filter(eventOf("presence")).at(-1)
		expect(presence?.event).toMatchObject({ participants: [{ name: "Ana", role: "host" }, { name: "Bo", role: "guest" }] })
		ana.ws.close()
		bo.ws.close()
	})

	it("resumes a dropped client with only the events it missed", async () => {
		const roomId = "r2"
		const ana = await TestClient.open()
		ana.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_ana", name: "Ana", roomId }), lastSeq: null })
		await ana.waitFor(isWelcome)
		const bo = await TestClient.open()
		bo.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_bo", name: "Bo", roomId }), lastSeq: null })
		await bo.waitFor(isWelcome)
		await ana.waitFor(eventOf("presence"))

		const seenBeforeDrop = bo.lastSeq
		bo.ws.close()
		ana.send({ type: "say", text: "Let's go with Postgres." })
		await ana.waitFor(eventOf("decision"))

		const back = await TestClient.open()
		back.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_bo", name: "Bo", roomId }), lastSeq: seenBeforeDrop })
		const welcome = await back.waitFor(isWelcome)
		expect(welcome.mode).toBe("replay")
		await back.waitFor(eventOf("decision"))
		const replayed = back.messages.filter((m) => m.type === "event")
		expect(replayed.every((m) => m.type === "event" && m.seq > seenBeforeDrop)).toBe(true)
		ana.ws.close()
		back.ws.close()
	})

	it("answers protocol violations without dropping well-behaved clients, and rate-limits floods", async () => {
		const c = await TestClient.open()
		c.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_x", name: "X", roomId: "r3" }), lastSeq: null })
		await c.waitFor(isWelcome)
		c.send({ type: "say", text: "" })
		expect(await c.waitFor(isError)).toMatchObject({ code: "bad_request", fatal: false })

		for (let i = 0; i < 20; i++) c.send({ type: "say", text: `line ${i}` })
		await c.waitFor((m): m is Extract<ServerMessage, { type: "error" }> => m.type === "error" && m.code === "rate_limited")
		c.send({ type: "ping" })
		await c.waitFor((m): m is Extract<ServerMessage, { type: "pong" }> => m.type === "pong")
		expect(c.closeCode).toBeNull()
		c.ws.close()
	})

	it("lets only the host end the meeting, and stores the final snapshot", async () => {
		const roomId = "r4"
		const host = await TestClient.open()
		host.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_h", name: "Host", roomId, role: "host" }), lastSeq: null })
		await host.waitFor(isWelcome)
		const guest = await TestClient.open()
		guest.send({ type: "hello", protocol: PROTOCOL_VERSION, token: await token({ sub: "u_g", name: "Guest", roomId }), lastSeq: null })
		await guest.waitFor(isWelcome)

		host.send({ type: "say", text: "Let's go with Friday." })
		await host.waitFor(eventOf("decision"))

		guest.send({ type: "end" })
		expect(await guest.waitFor(isError)).toMatchObject({ code: "forbidden", fatal: false })
		expect(saved.get(roomId)?.ended ?? false).toBe(false)

		host.send({ type: "end" })
		for (const c of [host, guest]) {
			await c.waitFor((m): m is Extract<ServerMessage, { type: "error" }> => m.type === "error" && m.code === "room_ended")
		}
		await expect.poll(() => saved.get(roomId)).toMatchObject({ ended: true, lastDecisions: 1 })
	})

	it("reports health and readiness", async () => {
		const ready = await server.app.inject({ method: "GET", url: "/readyz" })
		expect(ready.statusCode).toBe(200)
		expect(ready.json()).toMatchObject({ ok: true, capacity: 200 })
	})
})
