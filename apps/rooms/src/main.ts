import { createMem0Memory, createRoom, dedupeConsoleWarnings, defaultRoster, installProcessGuards, planModels } from "@quorum/engine"
import pino from "pino"
import { loadConfig } from "./config"
import { postgresRoomStore } from "./persistence"
import { flyCluster } from "./routing"
import { UnknownTemplateError, type RoomFactory } from "./room-registry"
import { buildServer } from "./server"

const config = loadConfig()
const logger = pino({
	level: config.LOG_LEVEL,
	redact: { paths: ["*.token", "*.apiKey", "req.headers.authorization"], remove: true },
	...(config.NODE_ENV === "development" ? { transport: undefined } : {}),
})

installProcessGuards((message, error) => logger.error({ err: error }, message))
dedupeConsoleWarnings()

const models = planModels(process.env)
const teamMemory = config.MEM0_API_KEY ? createMem0Memory(config.MEM0_API_KEY) : undefined
if (!teamMemory) logger.warn("MEM0_API_KEY not set — Memory Keeper disabled")

const TEMPLATES = new Set(["default"])

const roomFactory: RoomFactory = (roomId, template, context) => {
	if (!TEMPLATES.has(template)) throw new UnknownTemplateError(template)
	const scope = teamMemory && context.memoryScope ? context.memoryScope : undefined
	const roster = defaultRoster({
		tavilyApiKey: config.TAVILY_API_KEY,
		memory: teamMemory && scope ? { memory: teamMemory, scope, roomId } : undefined,
	})
	return createRoom({
		roomId,
		agents: roster.agents,
		...(teamMemory && scope ? { archive: { memory: teamMemory, scope, roomTitle: context.title ?? "Untitled meeting" } } : {}),
		models,
		budget: { softTokens: config.ROOM_SOFT_TOKENS, hardTokens: config.ROOM_HARD_TOKENS },
		maxConcurrentLoops: config.ROOM_MAX_CONCURRENT_LOOPS,
		report: (where, error) => logger.error({ err: error, roomId, where }, "room error"),
	})
}

const store = config.DATABASE_URL ? postgresRoomStore(config.DATABASE_URL) : undefined
if (!store) logger.warn("DATABASE_URL not set — meetings will not be saved")

const cluster =
	process.env.FLY_APP_NAME && process.env.FLY_MACHINE_ID ? flyCluster(process.env.FLY_APP_NAME, process.env.FLY_MACHINE_ID) : undefined
if (cluster) logger.info({ machine: cluster.self }, "cluster routing enabled")

const server = await buildServer({ config, roomFactory, logger, ...(store ? { store } : {}), ...(cluster ? { cluster } : {}) })
await server.app.listen({ host: config.HOST, port: config.PORT })
logger.info({ models, port: config.PORT }, "room server ready")

let shuttingDown = false
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		if (shuttingDown) return
		shuttingDown = true
		logger.info({ signal }, "draining")
		const force = setTimeout(() => process.exit(1), 10_000)
		force.unref()
		server
			.drain("The server is restarting — reconnecting shortly")
			.then(() => process.exit(0))
			.catch((error: unknown) => {
				logger.error({ err: error }, "drain failed")
				process.exit(1)
			})
	})
}
