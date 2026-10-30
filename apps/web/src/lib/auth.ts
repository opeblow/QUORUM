import "server-only"
import { schema } from "@quorum/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { anonymous } from "better-auth/plugins"
import { db } from "./db"
import { serverEnv } from "./env"

function createAuth() {
	const env = serverEnv()
	return betterAuth({
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		database: drizzleAdapter(db(), {
			provider: "pg",
			schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
		}),
		emailAndPassword: { enabled: true, minPasswordLength: 10, autoSignIn: true },
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			// Signed cookie cache: most requests validate the session without touching Postgres.
			cookieCache: { enabled: true, maxAge: 5 * 60 },
		},
		rateLimit: { enabled: true, window: 60, max: 100 },
		plugins: [
			// Meeting guests join from a link with only a name; they get a real (anonymous) account.
			anonymous({ emailDomainName: "guest.quorum.local" }),
			nextCookies(),
		],
	})
}

type Auth = ReturnType<typeof createAuth>
const globalForAuth = globalThis as unknown as { quorumAuth?: Auth }

export function auth(): Auth {
	globalForAuth.quorumAuth ??= createAuth()
	return globalForAuth.quorumAuth
}
