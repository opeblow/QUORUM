import type { z } from "zod"
import type { LockTable } from "../domain/lock-table"
import type { RoomStore } from "../domain/room-store"
import type { BudgetPressure } from "../domain/token-budget"
import type { AgentRole, RoomEvent } from "../domain/types"
import type { QueueMode } from "../domain/work-queue"
import type { RoomEventPayloads, RoomEventType } from "../events"

export type ModelTier = "fast" | "smart"

/** What an agent may touch. Agents never see the runtime library or other agents directly. */
export interface AgentServices {
	readonly self: string
	readonly store: RoomStore
	readonly locks: LockTable
	readonly pressure: () => BudgetPressure
	readonly now: () => number
	emit<T extends RoomEventType>(type: T, payload: RoomEventPayloads[T]): void
}

export interface ApprovalSpec {
	readonly kind: string
	readonly summary: string
	readonly details: Record<string, unknown>
	readonly utteranceSeq: number | null
}

export interface ApprovalOutcome {
	readonly approved: boolean
	readonly decidedBy: string
	readonly note: string | null
}

export interface ToolContext extends AgentServices {
	/** Set only for tools that require approval; the interception layer fills it in. */
	readonly approval: ApprovalOutcome | null
}

export interface ToolDefinition<TArgs = unknown> {
	readonly name: string
	readonly description: string
	readonly args: z.ZodType<TArgs>
	/**
	 * Return a spec to pause the loop for a human/agent decision before the tool runs, or null when
	 * no decision is needed for these args (e.g. a duplicate the tool will decline on its own).
	 */
	readonly requiresApproval?: (args: TArgs, svc: AgentServices) => ApprovalSpec | null
	invoke(args: TArgs, ctx: ToolContext): Promise<string>
}

/**
 * A declarative agent: *when* it wakes (select), *what* it sees (prompt), *what* it returns (output)
 * and *how* that changes the room (finish). The runtime adapter turns this into a live participant.
 */
export interface AgentDefinition<TInput, TOutput> {
	readonly role: AgentRole
	readonly name: string
	readonly capabilities: readonly string[]
	readonly tier: ModelTier
	readonly maxOutputTokens: number
	readonly queue: {
		readonly mode: QueueMode
		readonly concurrency: number
		readonly maxPending: number
		readonly merge?: (pending: TInput, next: TInput) => TInput
	}
	readonly instruction: string
	readonly output: z.ZodType<TOutput>
	readonly tools?: readonly ToolDefinition<never>[]
	/** Pure: is this bus event work for me? Called for every event, must be cheap and side-effect free. */
	select(event: RoomEvent, svc: AgentServices): TInput[]
	/** Claim the work (locks, open artifacts) right before running. Return null to skip it. */
	begin?(input: TInput, svc: AgentServices): TInput | null
	prompt(input: TInput, svc: AgentServices): string
	finish(output: TOutput, input: TInput, svc: AgentServices): void
	/** Undo begin() when the loop fails or is aborted. */
	fail?(input: TInput, svc: AgentServices, reason: string): void
}

// Erases TInput/TOutput so heterogeneous agents can live in one roster.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAgentDefinition = AgentDefinition<any, any>

export function defineAgent<TInput, TOutput>(def: AgentDefinition<TInput, TOutput>): AgentDefinition<TInput, TOutput> {
	return def
}

export function defineTool<TArgs>(def: ToolDefinition<TArgs>): ToolDefinition<never> {
	return def as unknown as ToolDefinition<never>
}

export function isEvent<T extends RoomEventType>(
	event: RoomEvent,
	type: T,
): event is RoomEvent<RoomEventPayloads[T]> {
	return event.type === type
}
