import type { Room } from "@quorum/engine"
import { randomUUID } from "node:crypto"
import type { AttachmentView, ChatView, ErrorCode, ParticipantRole, ServerMessage, SignalData, WireEvent } from "@quorum/protocol"
import type { Logger } from "pino"
import { SnapshotWriter, type RoomStorePort } from "./persistence"
import { toRoomView, toWireEvent, usageView } from "./wire"

export interface Participant {
	readonly id: string
	readonly name: string
	readonly role: ParticipantRole
}

export interface Client {
	readonly connectionId: string
	readonly participant: Participant
	send(message: ServerMessage): void
	close(code: number, reason: string): void
}

interface Sequenced {
	readonly seq: number
	readonly at: number
	readonly event: WireEvent
}

export interface RoomHostOptions {
	readonly maxClients: number
	readonly idleCloseMs: number
	readonly replayBufferSize?: number
	readonly usageIntervalMs?: number
	readonly onClosed: (roomId: string) => void
	readonly now?: () => number
	/** Durable storage for snapshots and meeting status; absent = in-memory only (dev/tests). */
	readonly store?: RoomStorePort
	readonly log?: Logger
}

export class ForbiddenError extends Error {
	override readonly name = "ForbiddenError"
}

/**
 * One live meeting on this server: the engine room plus the sockets watching it.
 * Every outgoing event gets a room-wide sequence number so clients can resume after a drop.
 */
export class RoomHost {
	private seq = 0
	private readonly buffer: Sequenced[] = []
	private readonly clients = new Map<string, Client>()
	private idleTimer: ReturnType<typeof setTimeout> | null = null
	private readonly usageTimer: ReturnType<typeof setInterval>
	private lastUsage = ""
	private closed = false
	private readonly unsubscribe: () => void
	private readonly now: () => number
	private readonly writer: SnapshotWriter | null
	private readonly chatLog: ChatView[] = []

	constructor(
		readonly room: Room,
		private readonly options: RoomHostOptions,
	) {
		this.now = options.now ?? Date.now
		this.writer =
			options.store && options.log
				? new SnapshotWriter(room.id, () => toRoomView(room, this.chatLog), options.store, options.log)
				: null
		this.unsubscribe = room.onEvent((event) => {
			const wire = toWireEvent(event, room)
			if (wire) this.publish(wire)
		})
		// Token usage changes on every model call; stream it at a calm, fixed rate instead.
		this.usageTimer = setInterval(() => this.publishUsage(), options.usageIntervalMs ?? 5_000)
		this.usageTimer.unref?.()
		this.armIdleTimer()
	}

	get id(): string {
		return this.room.id
	}

	get clientCount(): number {
		return this.clients.size
	}

	get isClosed(): boolean {
		return this.closed
	}

	/** Returns false when the room is full. Sends the welcome (snapshot or replay) itself. */
	attach(client: Client, lastSeq: number | null): boolean {
		if (this.closed) return false
		if (!this.clients.has(client.connectionId) && this.clients.size >= this.options.maxClients) return false
		this.clients.set(client.connectionId, client)
		this.disarmIdleTimer()

		const missed = this.replayFrom(lastSeq)
		const you = { id: client.participant.id, peerId: client.connectionId, name: client.participant.name, role: client.participant.role }
		if (missed) {
			client.send({ type: "welcome", you, mode: "replay", snapshot: null, seq: this.seq })
			for (const e of missed) client.send({ type: "event", seq: e.seq, at: e.at, event: e.event })
		} else {
			client.send({ type: "welcome", you, mode: "snapshot", snapshot: toRoomView(this.room, this.chatLog), seq: this.seq })
		}
		this.publishPresence()
		return true
	}

	detach(connectionId: string): void {
		if (!this.clients.delete(connectionId)) return
		this.publishPresence()
		if (this.clients.size === 0) this.armIdleTimer()
	}

	say(participant: Participant, text: string): void {
		this.room.say({ id: participant.id, name: participant.name }, text)
	}

	chat(participant: Participant, text: string, attachment: AttachmentView | null): void {
		if (!text && !attachment) return
		const message: ChatView = { id: randomUUID(), fromId: participant.id, fromName: participant.name, text, attachment, at: this.now() }
		this.chatLog.push(message)
		if (this.chatLog.length > 500) this.chatLog.shift()
		this.publish({ type: "chat", message })
	}

	decide(participant: Participant, approvalId: string, approved: boolean, note: string | null): void {
		this.room.decide(approvalId, approved, { id: participant.id, name: participant.name }, note ?? undefined)
	}

	/** Host only: end the meeting for everyone and record it as ended. */
	async end(participant: Participant): Promise<void> {
		if (participant.role !== "host") throw new ForbiddenError("Only the host can end the meeting")
		await this.options.store?.markEnded(this.room.id)
		await this.close("The host ended the meeting.", "room_ended")
	}

	/** Resolves once the final snapshot is stored (or failed and was logged). */
	async close(reason: string, code: ErrorCode = "room_closed"): Promise<void> {
		if (this.closed) return
		this.closed = true
		this.disarmIdleTimer()
		clearInterval(this.usageTimer)
		this.unsubscribe()
		this.room.close()
		// Persist before telling anyone: clients go straight to the recap, which reads this snapshot.
		this.writer?.markDirty()
		await this.writer?.close()
		for (const client of this.clients.values()) {
			client.send({ type: "error", code, message: reason, fatal: true })
			client.close(1001, "room closed")
		}
		this.clients.clear()
		this.options.onClosed(this.room.id)
	}

	private publish(event: WireEvent): void {
		if (this.closed) return
		const entry: Sequenced = { seq: ++this.seq, at: this.now(), event }
		this.buffer.push(entry)
		const max = this.options.replayBufferSize ?? 2000
		if (this.buffer.length > max) this.buffer.splice(0, this.buffer.length - max)
		if (event.type !== "presence" && event.type !== "usage") this.writer?.markDirty()
		const message: ServerMessage = { type: "event", seq: entry.seq, at: entry.at, event }
		for (const client of this.clients.values()) client.send(message)
	}

	/** Events after `lastSeq`, or null when a full snapshot is needed instead. */
	private replayFrom(lastSeq: number | null): Sequenced[] | null {
		if (lastSeq === null || lastSeq > this.seq) return null
		if (lastSeq === this.seq) return []
		const first = this.buffer[0]
		if (!first || first.seq > lastSeq + 1) return null
		return this.buffer.filter((e) => e.seq > lastSeq)
	}

	private publishPresence(): void {
		this.publish({
			type: "presence",
			participants: [...this.clients.values()].map((c) => ({
				id: c.participant.id,
				peerId: c.connectionId,
				name: c.participant.name,
				role: c.participant.role,
			})),
		})
	}

	/** Relay a call-signalling message to exactly one other connection in this room. */
	relay(fromConnectionId: string, toConnectionId: string, data: SignalData): boolean {
		if (fromConnectionId === toConnectionId) return false
		const target = this.clients.get(toConnectionId)
		if (!target || !this.clients.has(fromConnectionId)) return false
		target.send({ type: "signal", from: fromConnectionId, data })
		return true
	}

	private publishUsage(): void {
		const usage = usageView(this.room)
		const key = JSON.stringify(usage)
		if (key === this.lastUsage) return
		this.lastUsage = key
		this.publish({ type: "usage", usage })
	}

	private armIdleTimer(): void {
		this.disarmIdleTimer()
		this.idleTimer = setTimeout(() => void this.close("Room closed after inactivity"), this.options.idleCloseMs)
		this.idleTimer.unref?.()
	}

	private disarmIdleTimer(): void {
		if (this.idleTimer) clearTimeout(this.idleTimer)
		this.idleTimer = null
	}
}
