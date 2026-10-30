import { createHash } from "node:crypto"
import { resolveTxt } from "node:dns/promises"

/**
 * Rendezvous (highest-random-weight) hashing: every room has one owner among the live machines,
 * every machine computes the same owner independently, and adding/removing a machine only
 * moves ~1/N of rooms. No coordinator, no shared state.
 */
export function ownerOf(roomId: string, machines: readonly string[]): string | null {
	let best: string | null = null
	let bestScore = -1n
	for (const m of machines) {
		const score = BigInt(`0x${createHash("sha256").update(`${roomId}\u0000${m}`).digest("hex").slice(0, 15)}`)
		if (score > bestScore || (score === bestScore && best !== null && m < best)) {
			best = m
			bestScore = score
		}
	}
	return best
}

export interface ClusterView {
	readonly self: string
	machines(): Promise<string[]>
}

/**
 * Live machines of this Fly app, from Fly's internal DNS (`vms.<app>.internal` TXT:
 * "<machineId> <region>,…"). Cached briefly; on lookup failure we fall back to "just me",
 * which degrades to single-machine behaviour instead of refusing traffic.
 */
export function flyCluster(app: string, self: string, ttlMs = 5_000): ClusterView {
	let cache: { at: number; ids: string[] } | null = null
	return {
		self,
		async machines() {
			if (cache && Date.now() - cache.at < ttlMs) return cache.ids
			try {
				const records = await resolveTxt(`vms.${app}.internal`)
				const ids = records
					.flat()
					.join(",")
					.split(",")
					.map((entry) => entry.trim().split(/\s+/u)[0] ?? "")
					.filter(Boolean)
				cache = { at: Date.now(), ids: ids.length ? ids.sort() : [self] }
			} catch {
				cache = { at: Date.now(), ids: [self] }
			}
			return cache.ids
		},
	}
}
