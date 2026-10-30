export interface ApprovalRequest {
	readonly id: string
	readonly agentId: string
	readonly kind: string
	readonly summary: string
	readonly details: Record<string, unknown>
	/** Utterance this proposal came from, so other agents can veto it if that utterance is refuted. */
	readonly utteranceSeq: number | null
	readonly requestedAt: number
	readonly expiresAt: number
}

export interface ApprovalDecision {
	readonly approved: boolean
	readonly decidedBy: string
	readonly note: string | null
	readonly decidedAt: number
}

interface Pending {
	readonly request: ApprovalRequest
	readonly resolve: (decision: ApprovalDecision) => void
	readonly timer: ReturnType<typeof setTimeout>
}

/**
 * Holds paused agent loops waiting on a decision. Anyone in the room — a human or another agent —
 * may decide. Unanswered requests auto-reject on timeout: silence must never mean consent.
 */
export class ApprovalBroker {
	private readonly pending = new Map<string, Pending>()

	constructor(private readonly now: () => number = Date.now) {}

	request(input: Omit<ApprovalRequest, "requestedAt" | "expiresAt">, timeoutMs: number): {
		request: ApprovalRequest
		decision: Promise<ApprovalDecision>
	} {
		if (this.pending.has(input.id)) throw new Error(`Approval ${input.id} already pending`)
		const requestedAt = this.now()
		const request: ApprovalRequest = { ...input, requestedAt, expiresAt: requestedAt + timeoutMs }
		const decision = new Promise<ApprovalDecision>((resolve) => {
			const timer = setTimeout(() => {
				this.decide(request.id, { approved: false, decidedBy: "timeout", note: "No decision in time" })
			}, timeoutMs)
			timer.unref?.()
			this.pending.set(request.id, { request, resolve, timer })
		})
		return { request, decision }
	}

	/** Returns false when the request is unknown or already decided (first decision wins). */
	decide(id: string, decision: Omit<ApprovalDecision, "decidedAt">): boolean {
		const entry = this.pending.get(id)
		if (!entry) return false
		this.pending.delete(id)
		clearTimeout(entry.timer)
		entry.resolve({ ...decision, decidedAt: this.now() })
		return true
	}

	open(): ApprovalRequest[] {
		return [...this.pending.values()].map((p) => p.request)
	}

	get(id: string): ApprovalRequest | undefined {
		return this.pending.get(id)?.request
	}

	rejectAll(decidedBy: string, note: string): void {
		for (const id of [...this.pending.keys()]) this.decide(id, { approved: false, decidedBy, note })
	}
}
