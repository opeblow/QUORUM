import "server-only"
import { randomBytes } from "node:crypto"
import { rooms, type Room } from "@quorum/db"
import { and, desc, eq } from "drizzle-orm"
import { db } from "./db"

const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789"

/** Unguessable, URL-friendly room ids (~62 bits). Possession of the link = invitation. */
export function newRoomId(): string {
	const bytes = randomBytes(12)
	let id = ""
	for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length]
	return id
}

export async function createRoomRecord(ownerId: string, title: string): Promise<Room> {
	const [room] = await db()
		.insert(rooms)
		.values({ id: newRoomId(), ownerId, title, template: "default" })
		.returning()
	if (!room) throw new Error("Failed to create room")
	return room
}

export async function listRoomsFor(ownerId: string, limit = 50): Promise<Room[]> {
	return db().select().from(rooms).where(eq(rooms.ownerId, ownerId)).orderBy(desc(rooms.createdAt)).limit(limit)
}

export async function findRoom(id: string): Promise<Room | null> {
	if (!/^[a-z0-9]{8,32}$/u.test(id)) return null
	const [room] = await db().select().from(rooms).where(eq(rooms.id, id)).limit(1)
	return room ?? null
}

export async function endRoom(id: string, ownerId: string): Promise<void> {
	await db()
		.update(rooms)
		.set({ status: "ended", endedAt: new Date() })
		.where(and(eq(rooms.id, id), eq(rooms.ownerId, ownerId)))
}
