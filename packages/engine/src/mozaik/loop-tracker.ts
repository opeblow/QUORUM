interface Entry {
	readonly agentId: string
	readonly resolve: (answer: string) => void
	readonly reject: (error: LoopAbortedError) => void
	readonly timer: ReturnType<typeof setTimeout>
}

/** Raised when a loop is abandoned on purpose (failure, timeout, budget, shutdown). */
export class LoopAbortedError extends Error {
	override readonly name = "LoopAbortedError"
	constructor(readonly reason: string) {
		super(reason)
	}
}

const MAX_CANCELLED = 2000

/**
 * `runLoop` is fire-and-forget, so we turn each loop into a promise ourselves: we create a fresh
 * context per loop and key everything by its id, then bind the runtime's loopId when the loop
 * announces itself (message_received.started) and settle on model.answer.
 */
export class LoopTracker {
	private readonly byContext = new Map<string, Entry>()
	private readonly loopToContext = new Map<string, string>()
	private readonly cancelled = new Set<string>()

	register(contextId: string, agentId: string, timeoutMs: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => this.fail(contextId, `timed out after ${Math.round(timeoutMs / 1000)}s`), timeoutMs)
			timer.unref?.()
			this.byContext.set(contextId, { agentId, resolve, reject, timer })
		})
	}

	bindLoop(loopId: string, contextId: string): void {
		if (this.byContext.has(contextId)) this.loopToContext.set(loopId, contextId)
	}

	contextOf(loopId: string): string | undefined {
		return this.loopToContext.get(loopId)
	}

	answer(loopId: string, text: string): void {
		const contextId = this.loopToContext.get(loopId)
		if (!contextId) return
		this.loopToContext.delete(loopId)
		const entry = this.take(contextId)
		this.cancelled.delete(contextId)
		entry?.resolve(text)
	}

	fail(contextId: string, reason: string): void {
		const entry = this.take(contextId)
		if (!entry) return
		this.markCancelled(contextId)
		entry.reject(new LoopAbortedError(reason))
	}

	/** Interception consults this so an abandoned loop stops at its next transition instead of spending tokens. */
	isCancelled(contextId: string): boolean {
		return this.cancelled.has(contextId)
	}

	failAll(reason: string): void {
		for (const contextId of [...this.byContext.keys()]) this.fail(contextId, reason)
	}

	get pending(): number {
		return this.byContext.size
	}

	private take(contextId: string): Entry | undefined {
		const entry = this.byContext.get(contextId)
		if (!entry) return undefined
		this.byContext.delete(contextId)
		clearTimeout(entry.timer)
		for (const [loopId, ctx] of this.loopToContext) if (ctx === contextId) this.loopToContext.delete(loopId)
		return entry
	}

	private markCancelled(contextId: string): void {
		this.cancelled.add(contextId)
		if (this.cancelled.size > MAX_CANCELLED) {
			const oldest = this.cancelled.values().next().value
			if (oldest !== undefined) this.cancelled.delete(oldest)
		}
	}
}
