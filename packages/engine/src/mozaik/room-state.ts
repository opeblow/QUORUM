import { RuntimeState } from "@mozaik-ai/core"
import { ApprovalBroker } from "../domain/approval-broker"
import { LockTable } from "../domain/lock-table"
import { RoomStore } from "../domain/room-store"
import { Semaphore } from "../domain/semaphore"
import { TokenBudget, type BudgetLimits } from "../domain/token-budget"
import type { AgentPhase, AgentRole } from "../domain/types"

export interface AgentStatus {
	readonly id: string
	readonly role: AgentRole
	readonly name: string
	phase: AgentPhase
	detail: string | null
}

/**
 * The single shared state every participant in a room reads and writes.
 * Coordination primitives live here — locks, a loop semaphore, budget, pending approvals —
 * so agents coordinate through state instead of calling each other.
 */
export class RoomState extends RuntimeState {
	readonly store: RoomStore
	readonly locks: LockTable
	readonly llm: Semaphore
	readonly budget: TokenBudget
	readonly approvals: ApprovalBroker
	readonly agents = new Map<string, AgentStatus>()
	closing = false

	constructor(
		readonly roomId: string,
		options: { budget: BudgetLimits; maxConcurrentLoops: number; now: () => number },
	) {
		super()
		this.store = new RoomStore(roomId, 2000, options.now)
		this.locks = new LockTable(options.now)
		this.llm = new Semaphore(options.maxConcurrentLoops)
		this.budget = new TokenBudget(options.budget)
		this.approvals = new ApprovalBroker(options.now)
	}
}
