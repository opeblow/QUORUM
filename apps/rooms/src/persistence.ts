import { createDb, rooms, roomSnapshots } from "@quorum/db"
import type { RoomView } from "@quorum/protocol"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"

/** Where finished and in-progress meetings are kept. The room server is the only writer. */
export interface RoomStorePort {
	saveSnapshot(roomId: string, view: RoomView): Promise<void>
	markEnded(roomId: string): Promise<void>
}

export function postgresRoomStore(databaseUrl: string): RoomStorePort {
	const db = createDb(databaseUrl, { max: 4 })
	return {
		async saveSnapshot(roomId, view) {
			const now = new Date()
			await db
				.insert(roomSnapshots)
				.values({ roomId, snapshot: view, updatedAt: now })
				.onConflictDoUpdate({ target: roomSnapshots.roomId, set: { snapshot: view, updatedAt: now } })
		},
		async markEnded(roomId) {
			await db.update(rooms).set({ status: "ended", endedAt: new Date() }).where(eq(rooms.id, roomId))
		},
	}
}

/**
 * Coalesces snapshot writes: at most one write per interval per room, always the latest state,
 * and a final flush that callers can await when the room closes.
 */
export class SnapshotWriter {
	private dirty = false
	private writing: Promise<void> | null = null
	private readonly timer: ReturnType<typeof setInterval>

	constructor(
		private readonly roomId: string,
		private readonly read: () => RoomView,
		private readonly store: RoomStorePort,
		private readonly log: Logger,
		intervalMs = 5_000,
	) {
		this.timer = setInterval(() => void this.flush(), intervalMs)
		this.timer.unref?.()
	}

	markDirty(): void {
		this.dirty = true
	}

	async flush(): Promise<void> {
		if (this.writing) await this.writing
		if (!this.dirty) return
		this.dirty = false
		const view = this.read()
		this.writing = this.store
			.saveSnapshot(this.roomId, view)
			.catch((error: unknown) => {
				// Keep the room running; retry on the next tick.
				this.dirty = true
				this.log.error({ err: error, roomId: this.roomId }, "snapshot write failed")
			})
			.finally(() => {
				this.writing = null
			})
		await this.writing
	}

	async close(): Promise<void> {
		clearInterval(this.timer)
		await this.flush()
	}
}
