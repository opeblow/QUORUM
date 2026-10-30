import "server-only"
import { createDb, type Database } from "@quorum/db"
import { serverEnv } from "./env"

const globalForDb = globalThis as unknown as { quorumDb?: Database }

/** One pool per server process (and per hot-reload cycle in development). */
export function db(): Database {
	globalForDb.quorumDb ??= createDb(serverEnv().DATABASE_URL)
	return globalForDb.quorumDb
}
