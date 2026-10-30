import { createHuman, type Human, type SituationHandler } from "@mozaik-ai/core"
import type { BudgetPressure } from "../domain/token-budget"
import { LoopEvents, RoomEvents, type RoomEventPayloads } from "../events"
import type { RoomKernel } from "./kernel"
import { safeHandler } from "./safe"
import { EventIs, When } from "./specs"

/**
 * Rules-only participant (no model) that keeps the room healthy and lets agents check each other:
 * - meters every model call and degrades the room under budget pressure,
 * - applies approval verdicts submitted by anyone in the room,
 * - vetoes pending proposals built on a statement the Fact-Checker just refuted.
 */
export function createModerator(kernel: RoomKernel): Human {
	const { state } = kernel
	const baseLimit = state.llm.capacity
	let lastPressure: BudgetPressure = "ok"

	const handlers: SituationHandler[] = [
		{
			specification: new EventIs(LoopEvents.inferenceCompleted),
			processor: {
				apply({ event }) {
					const usage = (event.payload as { tokenUsage?: { inputTokens: number; outputTokens: number } }).tokenUsage
					if (!usage) return
					const pressure = state.budget.record({
						agentId: event.producerId,
						model: "unknown",
						inputTokens: usage.inputTokens,
						outputTokens: usage.outputTokens,
					})
					if (pressure === lastPressure) return
					lastPressure = pressure
					// Halve concurrency when spending runs hot; interception stops new inference at "hard".
					state.llm.setLimit(pressure === "ok" ? baseLimit : Math.max(1, Math.floor(baseLimit / 2)))
					kernel.emit(moderator.getId(), RoomEvents.budgetPressure, {
						pressure,
						totalTokens: state.budget.totalTokens,
						hardLimit: state.budget.limits.hardTokens,
					})
				},
			},
		},
		{
			specification: new EventIs(RoomEvents.approvalSubmitted),
			processor: {
				apply({ event }) {
					const payload = event.payload as RoomEventPayloads["approval.submitted"]
					const by = state.getParticipant(event.producerId)?.getManifest().name ?? event.producerId
					state.approvals.decide(payload.id, { approved: payload.approved, decidedBy: by, note: payload.note })
				},
			},
		},
		{
			specification: new EventIs(RoomEvents.claimResolved).and(
				new When(({ event }) => (event.payload as RoomEventPayloads["claim.resolved"]).claim.status === "refuted"),
			),
			processor: {
				apply({ event }) {
					const { claim } = event.payload as RoomEventPayloads["claim.resolved"]
					const checker = state.agents.get(claim.ownerId)?.name ?? "Fact-Checker"
					for (const request of state.approvals.open()) {
						if (request.utteranceSeq !== claim.utteranceSeq) continue
						state.approvals.decide(request.id, {
							approved: false,
							decidedBy: checker,
							note: `It relies on a statement that was refuted${claim.correction ? `: ${claim.correction}` : "."}`,
						})
					}
				},
			},
		},
	]

	const moderator = createHuman({ name: "Moderator", capabilities: ["budget", "veto", "approvals"], handlers: [] })
	moderator.setHandlers(handlers.map((h, i) => safeHandler(`Moderator#${i}`, h, kernel.report)))
	return moderator
}
