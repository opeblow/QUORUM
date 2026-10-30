import websocket from "@fastify/websocket"
import { LIMITS } from "@quorum/protocol"
import Fastify from "fastify"
import type { Logger } from "pino"
import { secretKey } from "./auth"
import { isOriginAllowed, type Config } from "./config"
import { handleConnection } from "./connection"
import type { RoomStorePort } from "./persistence"
import { RoomRegistry, type RoomFactory } from "./room-registry"
import { ownerOf, type ClusterView } from "./routing"

export interface ServerDeps {
	readonly config: Config
	readonly roomFactory: RoomFactory
	readonly logger: Logger
	readonly store?: RoomStorePort
	/** Multi-machine deployments: route each room to its owning machine. */
	readonly cluster?: ClusterView
}

export type RoomServer = Awaited<ReturnType<typeof buildServer>>

export async function buildServer({ config, roomFactory, logger, store, cluster }: ServerDeps) {
	const app = Fastify({ loggerInstance: logger, trustProxy: true })
	const registry = new RoomRegistry(roomFactory, {
		maxRooms: config.MAX_ROOMS,
		maxClientsPerRoom: config.MAX_CLIENTS_PER_ROOM,
		idleCloseMs: config.ROOM_IDLE_CLOSE_MS,
		log: logger,
		...(store ? { store } : {}),
	})
	const secret = secretKey(config.ROOMS_JWT_SECRET)
	let draining = false

	await app.register(websocket, { options: { maxPayload: LIMITS.maxMessageBytes } })

	app.get("/healthz", async () => ({ ok: true }))
	app.get("/readyz", async (_req, reply) => {
		if (draining) return reply.code(503).send({ ok: false, draining: true })
		return { ok: true, ...registry.stats(), capacity: config.MAX_ROOMS }
	})

	app.get(
		"/ws",
		{
			websocket: true,
			preValidation: async (request, reply) => {
				if (draining) return reply.code(503).send({ error: "draining" })
				if (!isOriginAllowed(config, request.headers.origin)) return reply.code(403).send({ error: "origin not allowed" })
				if (cluster) {
					const roomId = (request.query as { room?: unknown }).room
					// A room already live here stays here (a scale event must not split a meeting).
					if (typeof roomId === "string" && roomId && !registry.has(roomId)) {
						const owner = ownerOf(roomId, await cluster.machines())
						if (owner && owner !== cluster.self) {
							return reply.header("fly-replay", `instance=${owner}`).code(307).send()
						}
					}
				}
			},
		},
		(socket) => handleConnection(socket, { registry, secret, log: logger }),
	)

	return {
		app,
		registry,
		/** Stop accepting rooms, tell every client, close every room. */
		async drain(reason: string): Promise<void> {
			draining = true
			await registry.closeAll(reason)
			await app.close()
		},
	}
}
