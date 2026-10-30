/**
 * Per-agent intake. Agents react to a live stream faster than models answer, so input must be
 * shaped rather than queued without bound:
 * - "latest": single slot; newer work replaces (or merges into) pending work. Good for summaries.
 * - "queue": bounded FIFO; oldest work is dropped when full. Good for discrete items like claims.
 */
export type QueueMode = "latest" | "queue"

export interface WorkQueueOptions<T> {
	readonly mode: QueueMode
	readonly concurrency: number
	readonly maxPending: number
	readonly merge?: (pending: T, next: T) => T
	readonly onDrop?: (dropped: T) => void
}

export class WorkQueue<T> {
	private running = 0
	private readonly pending: T[] = []
	private closed = false

	constructor(
		private readonly worker: (item: T) => Promise<void>,
		private readonly options: WorkQueueOptions<T>,
	) {
		if (options.concurrency < 1) throw new Error("concurrency must be >= 1")
		if (options.maxPending < 1) throw new Error("maxPending must be >= 1")
	}

	get busy(): boolean {
		return this.running > 0
	}

	get size(): number {
		return this.pending.length
	}

	submit(item: T): void {
		if (this.closed) return
		if (this.options.mode === "latest" && this.pending.length > 0) {
			const previous = this.pending[0] as T
			this.pending[0] = this.options.merge ? this.options.merge(previous, item) : item
		} else {
			this.pending.push(item)
			while (this.pending.length > this.options.maxPending) {
				const dropped = this.pending.shift()
				if (dropped !== undefined) this.options.onDrop?.(dropped)
			}
		}
		this.pump()
	}

	close(): void {
		this.closed = true
		this.pending.length = 0
	}

	private pump(): void {
		while (!this.closed && this.running < this.options.concurrency && this.pending.length > 0) {
			const item = this.pending.shift() as T
			this.running++
			// The worker owns its own error reporting; the queue only guarantees it keeps draining.
			this.worker(item)
				.catch(() => undefined)
				.finally(() => {
					this.running--
					this.pump()
				})
		}
	}
}
