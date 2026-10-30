import { config } from "dotenv"
import { resolve } from "node:path"
import { createMem0Memory } from "../src/memory/mem0"

config({ path: [resolve(import.meta.dirname, "../../../.env.local")], quiet: true })
const mem = createMem0Memory(process.env.MEM0_API_KEY ?? "")
const scope = `smoke-${Date.now()}`
const t0 = Date.now()
await mem.remember(scope, "Decision: Use Postgres for the analytics service (meeting \"Smoke\", 2026-10-18)", { kind: "decision", roomId: "smoke", date: "2026-10-18" })
console.log("add ok in", Date.now() - t0, "ms")
for (let i = 0; i < 30; i++) {
	const hits = await mem.recall(scope, "which database for analytics?", 3)
	if (hits.length) {
		console.log("searchable after", Date.now() - t0, "ms:", JSON.stringify(hits[0]))
		process.exit(0)
	}
	await new Promise((r) => setTimeout(r, 2000))
}
console.log("not searchable after 60s")
