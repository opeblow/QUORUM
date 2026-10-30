import type { Room } from "@quorum/engine"
import type { Logger } from "pino"
import type { RoomStorePort } from "./persistence"
import { RoomHost } from "./room-host"

export interface RoomContext {
	readonly memoryScope?: string | undefined
	readonly title?: string | undefined
}

export type RoomFactory = (roomId: string, template: string, context: RoomContext) => Room

export interface RegistryOptions {
	readonly maxRooms: number
	readonly maxClientsPerRoom: number
	readonly idleCloseMs: number
	readonly store?: RoomStorePort
	readonly log?: Logger
}

export type Acquire = { ok: true; host: RoomHost } | { ok: false; reason: "server_busy" | "bad_template" }

export class UnknownTemplateError extends Error {
	override readonly name = "UnknownTemplateError"
}

/** Live rooms on this process. Rooms start on first join and close themselves when idle. */
export class RoomRegistry {
	private readonly hosts = new Map<string, RoomHost>()

	constructor(
		private readonly factory: RoomFactory,
		private readonly options: RegistryOptions,
	) {}

	acquire(roomId: string, template: string, context: RoomContext = {}): Acquire {
		const existing = this.hosts.get(roomId)
		if (existing && !existing.isClosed) return { ok: true, host: existing }
		if (this.hosts.size >= this.options.maxRooms) return { ok: false, reason: "server_busy" }
		let room: Room
		try {
			room = this.factory(roomId, template, context)
		} catch (error) {
			if (error instanceof UnknownTemplateError) return { ok: false, reason: "bad_template" }
			throw error
		}
		const host = new RoomHost(room, {
			maxClients: this.options.maxClientsPerRoom,
			idleCloseMs: this.options.idleCloseMs,
			...(this.options.store ? { store: this.options.store } : {}),
			...(this.options.log ? { log: this.options.log } : {}),
			onClosed: (id) => {
				if (this.hosts.get(id) === host) this.hosts.delete(id)
			},
		})
		this.hosts.set(roomId, host)
		return { ok: true, host }
	}

	has(roomId: string): boolean {
		const host = this.hosts.get(roomId)
		return host !== undefined && !host.isClosed
	}

	get size(): number {
		return this.hosts.size
	}

	stats(): { rooms: number; clients: number } {
		let clients = 0
		for (const h of this.hosts.values()) clients += h.clientCount
		return { rooms: this.hosts.size, clients }
	}

	async closeAll(reason: string): Promise<void> {
		await Promise.all([...this.hosts.values()].map((host) => host.close(reason)))
	}
}
