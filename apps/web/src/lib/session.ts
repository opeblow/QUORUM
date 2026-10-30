import "server-only"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "./auth"

export interface SessionUser {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly isAnonymous: boolean
}

/** Data Access Layer entry point: the only place that reads the session. Request-time data. */
export async function getSessionUser(): Promise<SessionUser | null> {
	// Read the request first: during prerendering this is where rendering bails out,
	// before anything touches secrets or the database.
	const requestHeaders = await headers()
	const session = await auth().api.getSession({ headers: requestHeaders })
	if (!session) return null
	const u = session.user as typeof session.user & { isAnonymous?: boolean | null }
	return { id: u.id, name: u.name, email: u.email, isAnonymous: Boolean(u.isAnonymous) }
}

/** For pages that need a real (non-guest) account. */
export async function requireMember(next = "/dashboard"): Promise<SessionUser> {
	const user = await getSessionUser()
	if (!user || user.isAnonymous) redirect(`/sign-in?next=${encodeURIComponent(next)}`)
	return user
}
