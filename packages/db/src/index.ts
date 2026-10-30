import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index"

export { schema }
export * from "./schema/index"

export type Database = ReturnType<typeof createDb>

/**
 * One pool per process. `max` stays small: serverless functions each hold their own pool,
 * and Postgres connection slots are the scarce resource, not throughput.
 */
export function createDb(url: string, options: { max?: number } = {}) {
	const client = postgres(url, {
		max: options.max ?? 5,
		idle_timeout: 20,
		connect_timeout: 10,
		prepare: false,
	})
	return drizzle(client, { schema, casing: "snake_case" })
}
