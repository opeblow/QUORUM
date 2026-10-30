interface Lease {
	readonly ownerId: string
	readonly expiresAt: number
}

/**
 * Ownership leases on shared work ("claim:<key>", "topic:<id>"…).
 * Leases expire so a crashed or stuck agent can never hold work forever.
 */
export class LockTable {
	private readonly leases = new Map<string, Lease>()

	constructor(private readonly now: () => number = Date.now) {}

	tryAcquire(key: string, ownerId: string, ttlMs: number): boolean {
		const current = this.live(key)
		if (current && current.ownerId !== ownerId) return false
		this.leases.set(key, { ownerId, expiresAt: this.now() + ttlMs })
		return true
	}

	release(key: string, ownerId: string): boolean {
		const current = this.live(key)
		if (!current || current.ownerId !== ownerId) return false
		this.leases.delete(key)
		return true
	}

	holder(key: string): string | undefined {
		return this.live(key)?.ownerId
	}

	isFree(key: string): boolean {
		return this.live(key) === undefined
	}

	snapshot(): Array<{ key: string; ownerId: string; expiresAt: number }> {
		const out: Array<{ key: string; ownerId: string; expiresAt: number }> = []
		for (const key of this.leases.keys()) {
			const lease = this.live(key)
			if (lease) out.push({ key, ...lease })
		}
		return out
	}

	private live(key: string): Lease | undefined {
		const lease = this.leases.get(key)
		if (!lease) return undefined
		if (lease.expiresAt <= this.now()) {
			this.leases.delete(key)
			return undefined
		}
		return lease
	}
}
