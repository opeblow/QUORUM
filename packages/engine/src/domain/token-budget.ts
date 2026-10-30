export type BudgetPressure = "ok" | "soft" | "hard"

export interface BudgetLimits {
	/** Above this many total tokens the room degrades (fewer concurrent loops, cheaper models). */
	readonly softTokens: number
	/** Above this the room stops starting new model work. */
	readonly hardTokens: number
}

export interface UsageRecord {
	readonly agentId: string
	readonly model: string
	readonly inputTokens: number
	readonly outputTokens: number
}

export class TokenBudget {
	private input = 0
	private output = 0
	private readonly byAgent = new Map<string, number>()

	constructor(readonly limits: BudgetLimits) {
		if (limits.softTokens > limits.hardTokens) throw new Error("softTokens must be <= hardTokens")
	}

	/** Returns the pressure level after recording, so callers can react to a transition. */
	record(usage: UsageRecord): BudgetPressure {
		this.input += usage.inputTokens
		this.output += usage.outputTokens
		const total = usage.inputTokens + usage.outputTokens
		this.byAgent.set(usage.agentId, (this.byAgent.get(usage.agentId) ?? 0) + total)
		return this.pressure()
	}

	get totalTokens(): number {
		return this.input + this.output
	}

	pressure(): BudgetPressure {
		const total = this.totalTokens
		if (total >= this.limits.hardTokens) return "hard"
		if (total >= this.limits.softTokens) return "soft"
		return "ok"
	}

	snapshot(): { inputTokens: number; outputTokens: number; byAgent: Record<string, number>; pressure: BudgetPressure } {
		return {
			inputTokens: this.input,
			outputTokens: this.output,
			byAgent: Object.fromEntries(this.byAgent),
			pressure: this.pressure(),
		}
	}
}
