import MemoryClient from "mem0ai"
import type { MemoryItem, TeamMemory } from "../domain/team-memory"

const TIMEOUT_MS = 10_000

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	return Promise.race([
		p,
		new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error(`mem0 ${what} timed out`)), TIMEOUT_MS)
		}),
	]).finally(() => clearTimeout(timer))
}

/**
 * Team memory on mem0. Facts are stored verbatim (infer: false) so a recalled decision reads
 * exactly as it was recorded; mem0 provides the semantic search across past meetings.
 */
export function createMem0Memory(apiKey: string): TeamMemory {
	const client = new MemoryClient({ apiKey })
	return {
		async remember(scope, text, meta) {
			await withTimeout(
				client.add([{ role: "user", content: text }], { userId: scope, agentId: "quorum", metadata: meta, infer: false }),
				"add",
			)
		},
		async recall(scope, query, limit) {
			const res = await withTimeout(client.search(query, { filters: { user_id: scope }, topK: limit }), "search")
			return (res.results ?? []).map(
				(m): MemoryItem => ({
					id: m.id,
					text: m.memory ?? "",
					createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
					score: typeof m.score === "number" ? m.score : null,
					meta: (m.metadata as Record<string, unknown> | null) ?? {},
				}),
			)
		},
	}
}
