/** Long-term memory shared by a team across meetings. Adapters live in src/memory/. */
export interface MemoryItem {
	readonly id: string
	readonly text: string
	readonly createdAt: string | null
	readonly score: number | null
	readonly meta: Record<string, unknown>
}

export interface TeamMemory {
	remember(scope: string, text: string, meta: Record<string, string | number>): Promise<void>
	recall(scope: string, query: string, limit: number): Promise<MemoryItem[]>
}
