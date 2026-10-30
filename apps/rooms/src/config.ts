import { z } from "zod"

const csv = z
	.string()
	.default("")
	.transform((s) =>
		s
			.split(",")
			.map((x) => x.trim())
			.filter(Boolean),
	)

const Env = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	HOST: z.string().default("0.0.0.0"),
	PORT: z.coerce.number().int().min(0).max(65535).default(4000),
	ROOMS_JWT_SECRET: z.string().min(32, "ROOMS_JWT_SECRET must be at least 32 characters"),
	/** Browser origins allowed to open sockets. Empty in development = localhost only. */
	ALLOWED_ORIGINS: csv,
	MAX_ROOMS: z.coerce.number().int().positive().default(200),
	MAX_CLIENTS_PER_ROOM: z.coerce.number().int().positive().default(50),
	ROOM_IDLE_CLOSE_MS: z.coerce.number().int().positive().default(10 * 60_000),
	ROOM_SOFT_TOKENS: z.coerce.number().int().positive().default(700_000),
	ROOM_HARD_TOKENS: z.coerce.number().int().positive().default(1_400_000),
	ROOM_MAX_CONCURRENT_LOOPS: z.coerce.number().int().positive().default(4),
	TAVILY_API_KEY: z.string().optional(),
	MEM0_API_KEY: z.string().optional(),
	/** Where snapshots and meeting status are stored. Required in production. */
	DATABASE_URL: z.string().url().optional(),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
})

export type Config = z.infer<typeof Env>

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
	const parsed = Env.safeParse(env)
	if (!parsed.success) {
		throw new Error(`Invalid room server configuration:\n${z.prettifyError(parsed.error)}`)
	}
	if (parsed.data.NODE_ENV === "production" && parsed.data.ALLOWED_ORIGINS.length === 0) {
		throw new Error("ALLOWED_ORIGINS must be set in production")
	}
	if (parsed.data.NODE_ENV === "production" && !parsed.data.DATABASE_URL) {
		throw new Error("DATABASE_URL must be set in production")
	}
	return parsed.data
}

export function isOriginAllowed(config: Pick<Config, "NODE_ENV" | "ALLOWED_ORIGINS">, origin: string | undefined): boolean {
	if (!origin) return config.NODE_ENV !== "production"
	if (config.ALLOWED_ORIGINS.includes(origin)) return true
	if (config.NODE_ENV === "production") return false
	try {
		const { hostname } = new URL(origin)
		return hostname === "localhost" || hostname === "127.0.0.1"
	} catch {
		return false
	}
}
