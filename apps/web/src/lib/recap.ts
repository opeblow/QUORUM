import "server-only"
import { roomSnapshots } from "@quorum/db"
import { RoomView } from "@quorum/protocol"
import { eq } from "drizzle-orm"
import { db } from "./db"

/** The meeting as the room server last saved it, validated against the wire contract. */
export async function getRoomSnapshot(roomId: string): Promise<RoomView | null> {
	const [row] = await db().select().from(roomSnapshots).where(eq(roomSnapshots.roomId, roomId)).limit(1)
	if (!row) return null
	const parsed = RoomView.safeParse(row.snapshot)
	return parsed.success ? parsed.data : null
}
