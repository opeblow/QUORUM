export type Release = () => void

/**
 * Counting semaphore capping concurrent model loops per room.
 * `setLimit` lets the Moderator shrink concurrency at runtime under budget pressure.
 */
export class Semaphore {
	private inFlight = 0
	private readonly waiters: Array<() => void> = []

	constructor(private limit: number) {
		if (limit < 1) throw new Error("Semaphore limit must be >= 1")
	}

	get active(): number {
		return this.inFlight
	}

	get waiting(): number {
		return this.waiters.length
	}

	get capacity(): number {
		return this.limit
	}

	setLimit(limit: number): void {
		if (limit < 1) throw new Error("Semaphore limit must be >= 1")
		this.limit = limit
		this.drain()
	}

	tryAcquire(): Release | null {
		if (this.inFlight >= this.limit) return null
		this.inFlight++
		return this.releaser()
	}

	acquire(): Promise<Release> {
		const immediate = this.tryAcquire()
		if (immediate) return Promise.resolve(immediate)
		return new Promise((resolve) => {
			this.waiters.push(() => {
				this.inFlight++
				resolve(this.releaser())
			})
		})
	}

	private releaser(): Release {
		let released = false
		return () => {
			if (released) return
			released = true
			this.inFlight--
			this.drain()
		}
	}

	private drain(): void {
		while (this.inFlight < this.limit && this.waiters.length > 0) {
			this.waiters.shift()?.()
		}
	}
}
