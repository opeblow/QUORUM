import "server-only"
import { z } from "zod"

const ServerEnv = z.object({
	DATABASE_URL: z.string().url(),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.string().url(),
	ROOMS_JWT_SECRET: z.string().min(32),
	NEXT_PUBLIC_ROOMS_URL: z.string().url(),
})

let cached: z.infer<typeof ServerEnv> | undefined

/** Validated lazily so `next build` can run without production secrets present. */
export function serverEnv(): z.infer<typeof ServerEnv> {
	if (cached) return cached
	const parsed = ServerEnv.safeParse(process.env)
	if (!parsed.success) throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`)
	cached = parsed.data
	return cached
}
