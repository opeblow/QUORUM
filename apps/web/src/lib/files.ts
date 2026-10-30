import "server-only"
import { randomUUID } from "node:crypto"
import { roomFiles } from "@quorum/db"
import { eq } from "drizzle-orm"
import { db } from "./db"

export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** What people may share in a meeting. Anything executable or scriptable is refused. */
export const ALLOWED_MIME = new Set([
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
	"text/plain",
	"text/csv",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/msword",
	"application/vnd.ms-excel",
	"application/vnd.ms-powerpoint",
])

export async function saveFile(input: { roomId: string; uploaderId: string; name: string; mime: string; data: Buffer }) {
	const id = randomUUID()
	const name = input.name.replace(/[\u0000-\u001f\/]/gu, "_").slice(0, 200) || "file"
	await db().insert(roomFiles).values({ id, roomId: input.roomId, uploaderId: input.uploaderId, name, mime: input.mime, size: input.data.length, data: input.data })
	return { id, name, size: input.data.length, mime: input.mime }
}

export async function loadFile(id: string) {
	if (!/^[0-9a-f-]{36}$/u.test(id)) return null
	const [row] = await db().select().from(roomFiles).where(eq(roomFiles.id, id)).limit(1)
	return row ?? null
}
