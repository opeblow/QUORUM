import { RoomTokenClaims } from "@quorum/protocol"
import { jwtVerify } from "jose"

export const TOKEN_ISSUER = "quorum-web"
export const TOKEN_AUDIENCE = "quorum-rooms"

export class AuthError extends Error {
	override readonly name = "AuthError"
}

/** Room tokens are short-lived HS256 JWTs minted by the web app for one participant in one room. */
export async function verifyRoomToken(token: string, secret: Uint8Array): Promise<RoomTokenClaims> {
	try {
		const { payload } = await jwtVerify(token, secret, {
			algorithms: ["HS256"],
			issuer: TOKEN_ISSUER,
			audience: TOKEN_AUDIENCE,
			requiredClaims: ["exp", "sub"],
		})
		const claims = RoomTokenClaims.safeParse(payload)
		if (!claims.success) throw new AuthError("token claims are invalid")
		return claims.data
	} catch (error) {
		if (error instanceof AuthError) throw error
		throw new AuthError("token is invalid or expired")
	}
}

export function secretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret)
}
