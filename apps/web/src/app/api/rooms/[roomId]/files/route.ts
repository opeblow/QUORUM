import { NextResponse } from "next/server"
import { ALLOWED_MIME, MAX_FILE_BYTES, saveFile } from "@/lib/files"
import { findRoom } from "@/lib/rooms"
import { getSessionUser } from "@/lib/session"

/** Upload a file to share in a meeting's chat. Any participant (member or guest) of an open room. */
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
	const { roomId } = await params
	const user = await getSessionUser()
	if (!user) return NextResponse.json({ error: "Join the meeting first" }, { status: 401 })
	const room = await findRoom(roomId)
	if (!room || room.status !== "open") return NextResponse.json({ error: "Room not available" }, { status: 404 })

	const length = Number(request.headers.get("content-length") ?? 0)
	if (length > MAX_FILE_BYTES + 64 * 1024) return NextResponse.json({ error: "Files can be up to 10 MB" }, { status: 413 })

	const form = await request.formData().catch(() => null)
	const file = form?.get("file")
	if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })
	if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Files can be up to 10 MB" }, { status: 413 })
	if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "That file type isn't supported" }, { status: 415 })

	const saved = await saveFile({ roomId: room.id, uploaderId: user.id, name: file.name, mime: file.type, data: Buffer.from(await file.arrayBuffer()) })
	return NextResponse.json(saved, { status: 201 })
}
