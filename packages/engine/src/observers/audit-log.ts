import type { RoomEvent } from "../domain/types"
import { LoopEvents, RoomEvents, type RoomEventPayloads } from "../events"

/**
 * Maps bus events to JSONL audit lines in the shape kaleidoskop (JigJoy's run-replay viewer)
 * reads: `{ ts, source, item: { type, data } }`, with LLM items as flat runtime items.
 * Raw provider responses and full prompts are deliberately never written.
 */
export interface AuditLine {
	readonly ts: string
	readonly source: string
	readonly item: Record<string, unknown>
}

export type NameOf = (participantId: string) => string

export function toAuditLine(event: RoomEvent, nameOf: NameOf): AuditLine | null {
	const item = toItem(event)
	if (!item) return null
	return { ts: event.occurredAt.toISOString(), source: nameOf(event.producerId), item }
}

function toItem(event: RoomEvent): Record<string, unknown> | null {
	const p = event.payload as Record<string, unknown>
	switch (event.type) {
		case LoopEvents.participantJoined:
			return wrap("agent_state", { phase: "joined", detail: (p as { name?: string }).name ?? null })
		case RoomEvents.agentPhase: {
			const { phase, detail } = p as RoomEventPayloads["agent.phase"]
			return wrap("agent_state", { phase, detail })
		}
		case LoopEvents.functionCallStarted: {
			const call = (p as { call: { callId: string; name: string; args: string } }).call
			return { type: "function_call", call_id: call.callId, name: call.name, arguments: redactArgs(call.args) }
		}
		case LoopEvents.functionCallCompleted: {
			const out = p as { callId?: string; output?: { text?: string } }
			return { type: "function_call_output", call_id: out.callId ?? null, output: clip(out.output?.text ?? "", 2000) }
		}
		case LoopEvents.modelAnswer: {
			const text = (p as { answer?: { content?: { text?: string } } }).answer?.content?.text ?? ""
			return { type: "message", role: "assistant", content: clip(text, 4000) }
		}
		case RoomEvents.utteranceFinal: {
			const { utterance } = p as RoomEventPayloads["utterance.final"]
			return wrap("agent_user_message", { seq: utterance.seq, text: utterance.text })
		}
		case RoomEvents.claimDetected:
		case RoomEvents.claimResolved: {
			const { claim } = p as RoomEventPayloads["claim.resolved"]
			return wrap("critique", { kind: "claim", id: claim.id, status: claim.status, text: claim.text, verdict: claim.verdict })
		}
		case RoomEvents.challengeRaised: {
			const { challenge } = p as RoomEventPayloads["challenge.raised"]
			return wrap("critique", { ...challenge, kind: "challenge" })
		}
		case RoomEvents.decisionRecorded:
			return wrap("knowledge", { kind: "decision", ...(p as RoomEventPayloads["decision.recorded"]).decision })
		case RoomEvents.summaryUpdated:
			return wrap("knowledge", { kind: "summary", ...(p as RoomEventPayloads["summary.updated"]).summary })
		case RoomEvents.approvalRequested:
			return wrap("coordination", { ...(p as RoomEventPayloads["approval.requested"]).request, step: "approval_requested" })
		case RoomEvents.approvalDecided:
			return wrap("coordination", { ...p, step: "approval_decided" })
		case RoomEvents.actionDecided:
			return wrap("agent_result", { kind: "action", ...(p as RoomEventPayloads["action.decided"]).action })
		case RoomEvents.budgetPressure:
			return wrap("coordination", { kind: "budget", ...p })
		case RoomEvents.agentFailed:
			return wrap("error", { ...p })
		case RoomEvents.agentSkipped:
			return wrap("agent_state", { phase: "skipped", detail: (p as { reason?: string }).reason ?? null })
		default:
			return null
	}
}

function wrap(type: string, data: Record<string, unknown>): Record<string, unknown> {
	return { type, data }
}

function redactArgs(raw: string): string {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>
		delete parsed.__quorum_approval
		return JSON.stringify(parsed)
	} catch {
		return clip(raw, 500)
	}
}

function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max)}…`
}
