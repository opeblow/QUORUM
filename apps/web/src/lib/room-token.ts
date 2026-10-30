import "server-only"
import type { ParticipantRole } from "@quorum/protocol"
import { SignJWT } from "jose"
import { serverEnv } from "./env"

// Must match apps/rooms/src/auth.ts
const ISSUER = "quorum-web"
const AUDIENCE = "quorum-rooms"
const TTL_SECONDS = 10 * 60

/** Short-lived ticket for one participant to open one room's socket. Re-minted on reconnect. */
export async function mintRoomToken(input: {
	userId: string
	name: string
	roomId: string
	role: ParticipantRole
	template: string
	memoryScope: string
	title: string
}): Promise<{ token: string; expiresAt: number }> {
	const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS
	const token = await new SignJWT({
		name: input.name,
		roomId: input.roomId,
		role: input.role,
		template: input.template,
		memoryScope: input.memoryScope,
		title: input.title.slice(0, 120),
	})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(input.userId)
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(new TextEncoder().encode(serverEnv().ROOMS_JWT_SECRET))
	return { token, expiresAt: expiresAt * 1000 }
}
