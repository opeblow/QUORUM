/**
 * Local Postgres without Docker: runs the official PostgreSQL binaries as a child process.
 * Same port and credentials as docker-compose.yml, so either works with the same DATABASE_URL:
 *   postgres://quorum:quorum@localhost:54329/quorum
 */
import EmbeddedPostgres from "embedded-postgres"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

const dataDir = resolve(import.meta.dirname, "../../../.data/postgres")
const firstRun = !existsSync(resolve(dataDir, "PG_VERSION"))

const pg = new EmbeddedPostgres({
	databaseDir: dataDir,
	user: "quorum",
	password: "quorum",
	port: 54329,
	persistent: true,
	// Without this, initdb on Windows inherits the OS code page (WIN1252) and rejects names
	// like "Petrović". Production (Neon) is UTF-8; local must match.
	initdbFlags: ["--encoding=UTF8", "--locale=C"],
	onLog: () => {},
})

if (firstRun) await pg.initialise()
await pg.start()
if (firstRun) await pg.createDatabase("quorum")

const sql = postgres("postgres://quorum:quorum@localhost:54329/quorum", { max: 1 })
const [row] = await sql<{ server_encoding: string }[]>`show server_encoding`
await sql.end()
if (row?.server_encoding !== "UTF8") {
	console.error(
		`Local Postgres uses ${row?.server_encoding}, not UTF8. Stop it, delete .data/postgres and run this again to re-create it.`,
	)
	await pg.stop()
	process.exit(1)
}

console.log("Postgres ready on postgres://quorum:quorum@localhost:54329/quorum  (UTF8, Ctrl+C to stop)")

const stop = async () => {
	await pg.stop()
	process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
