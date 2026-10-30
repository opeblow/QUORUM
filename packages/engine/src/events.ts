import type { ApprovalRequest } from "./domain/approval-broker"
import type { BudgetPressure } from "./domain/token-budget"
import type { ActionItem, AgentPhase, AgentRole, Challenge, Claim, Decision, Recall, Summary, Utterance } from "./domain/types"

/** Custom room events published on the runtime bus, alongside the runtime's own loop events. */
export const RoomEvents = {
	utteranceFinal: "utterance.final",
	agentPhase: "agent.phase",
	agentFailed: "agent.failed",
	agentSkipped: "agent.skipped",
	claimDetected: "claim.detected",
	claimResolved: "claim.resolved",
	decisionRecorded: "decision.recorded",
	actionDecided: "action.decided",
	approvalRequested: "approval.requested",
	approvalDecided: "approval.decided",
	approvalSubmitted: "approval.submitted",
	challengeRaised: "challenge.raised",
	summaryUpdated: "summary.updated",
	budgetPressure: "budget.pressure",
	memoryRecalled: "memory.recalled",
} as const

/** Event types emitted by the runtime's agent loop. */
export const LoopEvents = {
	messageReceivedStarted: "message_received.started",
	inferenceStarted: "inference.started",
	inferenceCompleted: "inference.completed",
	functionCallStarted: "function_call.started",
	functionCallCompleted: "function_call.completed",
	modelAnswer: "model.answer",
	interceptionStarted: "interception.started",
	interceptionFinished: "interception.finished",
	participantJoined: "participant.joined",
	participantLeft: "participant.left",
} as const

export interface RoomEventPayloads {
	"utterance.final": { utterance: Utterance }
	"agent.phase": { agentId: string; role: AgentRole; phase: AgentPhase; detail: string | null }
	"agent.failed": { agentId: string; role: AgentRole; reason: string }
	"agent.skipped": { agentId: string; role: AgentRole; reason: string }
	"claim.detected": { claim: Claim }
	"claim.resolved": { claim: Claim }
	"decision.recorded": { decision: Decision }
	"action.decided": { action: ActionItem }
	"approval.requested": { request: ApprovalRequest }
	"approval.decided": { id: string; approved: boolean; decidedBy: string; note: string | null }
	/** A participant (human or agent) submits a verdict; the Moderator applies it to the broker. */
	"approval.submitted": { id: string; approved: boolean; note: string | null }
	"challenge.raised": { challenge: Challenge }
	"summary.updated": { summary: Summary }
	"budget.pressure": { pressure: BudgetPressure; totalTokens: number; hardLimit: number }
	"memory.recalled": { recall: Recall }
}

export type RoomEventType = keyof RoomEventPayloads
