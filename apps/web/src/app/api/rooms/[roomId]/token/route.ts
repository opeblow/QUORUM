import { NextResponse } from "next/server"
import { findRoom } from "@/lib/rooms"
import { mintRoomToken } from "@/lib/room-token"
import { getSessionUser } from "@/lib/session"
import { serverEnv } from "@/lib/env"

/** Exchange a signed-in session (member or guest) for a short-lived room socket ticket. */
export async function POST(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
	const { roomId } = await params
	const user = await getSessionUser()
	if (!user) return NextResponse.json({ error: "Sign in or join as a guest first" }, { status: 401 })

	const room = await findRoom(roomId)
	if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })
	if (room.status !== "open") return NextResponse.json({ error: "This meeting has ended" }, { status: 410 })

	const { token, expiresAt } = await mintRoomToken({
		userId: user.id,
		name: user.name,
		roomId: room.id,
		role: room.ownerId === user.id ? "host" : "guest",
		template: room.template,
		// Team memory belongs to the room owner, whoever is asking.
		memoryScope: `owner:${room.ownerId}`,
		title: room.title,
	})
	return NextResponse.json(
		// The room id in the URL lets the room cluster route the socket to the machine that owns it.
		{ token, expiresAt, url: `${serverEnv().NEXT_PUBLIC_ROOMS_URL}?room=${encodeURIComponent(room.id)}` },
		{ headers: { "cache-control": "no-store" } },
	)
}
