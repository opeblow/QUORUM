import { randomUUID } from "node:crypto"
import { ClientMessage, PROTOCOL_VERSION, type ErrorCode, type ServerMessage } from "@quorum/protocol"
import type { Logger } from "pino"
import type { WebSocket } from "ws"
import { AuthError, verifyRoomToken } from "./auth"
import { TokenBucket } from "./rate-limit"
import type { RoomRegistry } from "./room-registry"
import { ForbiddenError, type Client, type Participant, type RoomHost } from "./room-host"

export interface ConnectionDeps {
	readonly registry: RoomRegistry
	readonly secret: Uint8Array
	readonly log: Logger
	readonly helloTimeoutMs?: number
	readonly heartbeatMs?: number
}

const MAX_BUFFERED_BYTES = 4 * 1024 * 1024
const MAX_VIOLATIONS = 30

/** Lifecycle of one browser socket: hello → attach → say/decide … → detach. */
export function handleConnection(socket: WebSocket, deps: ConnectionDeps): void {
	const connectionId = randomUUID()
	const log = deps.log.child({ connectionId })
	let host: RoomHost | null = null
	let participant: Participant | null = null
	let violations = 0
	let alive = true

	const buckets = {
		any: new TokenBucket(40, 15),
		say: new TokenBucket(10, 2),
		decide: new TokenBucket(6, 1),
		// ICE candidates arrive in bursts while a call connects.
		signal: new TokenBucket(200, 50),
		chat: new TokenBucket(10, 3),
	}

	const send = (message: ServerMessage): void => {
		if (socket.readyState !== socket.OPEN) return
		// A client that can't keep up must not grow server memory without bound.
		if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
			log.warn("closing slow consumer")
			socket.close(1013, "slow consumer")
			return
		}
		socket.send(JSON.stringify(message))
	}

	const fail = (code: ErrorCode, message: string, fatal: boolean): void => {
		send({ type: "error", code, message, fatal })
		if (fatal) socket.close(code === "unauthorized" ? 4401 : 4400, code)
	}

	const violation = (code: ErrorCode, message: string): void => {
		violations++
		fail(code, message, violations >= MAX_VIOLATIONS)
	}

	const helloTimer = setTimeout(() => {
		if (!host) fail("unauthorized", "hello not received in time", true)
	}, deps.helloTimeoutMs ?? 10_000)

	const heartbeat = setInterval(() => {
		if (!alive) {
			log.info("terminating unresponsive socket")
			socket.terminate()
			return
		}
		alive = false
		socket.ping()
	}, deps.heartbeatMs ?? 25_000)
	socket.on("pong", () => {
		alive = true
	})

	socket.on("message", (raw, isBinary) => {
		alive = true
		if (isBinary) return violation("bad_request", "binary frames are not supported")
		if (message0IsSignal(raw) ? !buckets.signal.take() : !buckets.any.take()) return violation("rate_limited", "too many messages")

		let json: unknown
		try {
			json = JSON.parse(raw.toString())
		} catch {
			return violation("bad_request", "message is not valid JSON")
		}
		const parsed = ClientMessage.safeParse(json)
		if (!parsed.success) return violation("bad_request", "message does not match the protocol")
		const message = parsed.data

		if (message.type === "ping") return send({ type: "pong" })

		if (message.type === "hello") {
			if (host) return violation("bad_request", "already joined")
			void join(message.token, message.lastSeq)
			return
		}

		if (!host || !participant) return fail("unauthorized", "send hello first", true)

		try {
			if (message.type === "say") {
				if (!buckets.say.take()) return violation("rate_limited", "speaking too fast")
				host.say(participant, message.text)
			} else if (message.type === "decide") {
				if (!buckets.decide.take()) return violation("rate_limited", "too many decisions")
				host.decide(participant, message.approvalId, message.approved, message.note)
			} else if (message.type === "chat") {
				if (!buckets.chat.take()) return violation("rate_limited", "sending messages too fast")
				host.chat(participant, message.text, message.attachment)
			} else if (message.type === "signal") {
				host.relay(connectionId, message.to, message.data)
			} else if (message.type === "end") {
				host.end(participant).catch((error: unknown) => {
					if (error instanceof ForbiddenError) return fail("forbidden", error.message, false)
					log.error({ err: error }, "ending the room failed")
					fail("internal", "could not end the meeting", false)
				})
			}
		} catch (error) {
			log.error({ err: error }, "room rejected client message")
			fail("internal", "the room could not process that", false)
		}
	})

	async function join(token: string, lastSeq: number | null): Promise<void> {
		try {
			const claims = await verifyRoomToken(token, deps.secret)
			if (socket.readyState !== socket.OPEN) return
			const acquired = deps.registry.acquire(claims.roomId, claims.template, { memoryScope: claims.memoryScope, title: claims.title })
			if (!acquired.ok) {
				return fail(acquired.reason === "server_busy" ? "server_busy" : "bad_request", acquired.reason, true)
			}
			participant = { id: claims.sub, name: claims.name, role: claims.role }
			const client: Client = { connectionId, participant, send, close: (code, reason) => socket.close(code, reason) }
			if (!acquired.host.attach(client, lastSeq)) return fail("room_full", "this room is full", true)
			host = acquired.host
			clearTimeout(helloTimer)
			log.info({ roomId: claims.roomId, role: claims.role, protocol: PROTOCOL_VERSION }, "joined room")
		} catch (error) {
			if (error instanceof AuthError) return fail("unauthorized", error.message, true)
			log.error({ err: error }, "join failed")
			fail("internal", "could not join the room", true)
		}
	}

	socket.on("close", () => {
		clearTimeout(helloTimer)
		clearInterval(heartbeat)
		host?.detach(connectionId)
	})

	socket.on("error", (error) => log.warn({ err: error }, "socket error"))
}

/** Cheap pre-parse check so signalling traffic uses its own (larger) rate budget. */
function message0IsSignal(raw: unknown): boolean {
	return String(raw).startsWith('{"type":"signal"')
}
