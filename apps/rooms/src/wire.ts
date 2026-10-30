import { RoomEvents, type ApprovalRequest, type Room, type RoomEvent, type RoomEventPayloads } from "@quorum/engine"
import type { ApprovalView, ChatView, ClaimView, RoomView, WireEvent } from "@quorum/protocol"

/**
 * Anti-corruption layer: engine events → the public wire contract. Only what a browser needs
 * crosses this line — never prompts, provider responses, tool arguments or internal ids beyond
 * what the UI renders.
 */
export function toWireEvent(event: RoomEvent, room: Room): WireEvent | null {
	const p = event.payload
	switch (event.type) {
		case RoomEvents.utteranceFinal:
			return { type: "utterance", utterance: (p as RoomEventPayloads["utterance.final"]).utterance }
		case RoomEvents.agentPhase: {
			const a = p as RoomEventPayloads["agent.phase"]
			return {
				type: "agent",
				agent: { id: a.agentId, role: a.role, name: room.nameOf(a.agentId), phase: a.phase, detail: a.detail },
			}
		}
		case RoomEvents.claimDetected:
		case RoomEvents.claimResolved: {
			const { claim } = p as RoomEventPayloads["claim.resolved"]
			return { type: "claim", claim: claimView(claim) }
		}
		case RoomEvents.decisionRecorded: {
			const { decision: d } = p as RoomEventPayloads["decision.recorded"]
			return {
				type: "decision",
				decision: { id: d.id, text: d.text, rationale: d.rationale, utteranceSeq: d.utteranceSeq, createdAt: d.createdAt },
			}
		}
		case RoomEvents.actionDecided: {
			const { action: a } = p as RoomEventPayloads["action.decided"]
			return {
				type: "action",
				action: {
					id: a.id,
					task: a.task,
					assignee: a.assignee,
					due: a.due,
					status: a.status,
					decidedBy: a.decidedBy,
					decisionNote: a.decisionNote,
					createdAt: a.createdAt,
				},
			}
		}
		case RoomEvents.approvalRequested:
			return { type: "approval.requested", approval: approvalView((p as RoomEventPayloads["approval.requested"]).request) }
		case RoomEvents.approvalDecided: {
			const d = p as RoomEventPayloads["approval.decided"]
			return { type: "approval.decided", id: d.id, approved: d.approved, decidedBy: d.decidedBy, note: d.note }
		}
		case RoomEvents.challengeRaised: {
			const { challenge: c } = p as RoomEventPayloads["challenge.raised"]
			return {
				type: "challenge",
				challenge: { id: c.id, topic: c.topic, argument: c.argument, question: c.question, createdAt: c.createdAt },
			}
		}
		case RoomEvents.memoryRecalled: {
			const { recall: r } = p as RoomEventPayloads["memory.recalled"]
			return { type: "recall", recall: { id: r.id, memory: r.memory, when: r.when, relation: r.relation, note: r.note, createdAt: r.createdAt } }
		}
		case RoomEvents.summaryUpdated: {
			const { summary: s } = p as RoomEventPayloads["summary.updated"]
			return { type: "summary", summary: { text: s.text, topics: s.topics, updatedAt: s.updatedAt } }
		}
		case RoomEvents.budgetPressure:
			return { type: "usage", usage: usageView(room) }
		case RoomEvents.agentFailed: {
			const f = p as RoomEventPayloads["agent.failed"]
			return { type: "agent.failed", agentId: f.agentId, reason: f.reason }
		}
		default:
			return null
	}
}

export function toRoomView(room: Room, chat: readonly ChatView[] = []): RoomView {
	const s = room.snapshot()
	return {
		roomId: s.roomId,
		utterances: s.utterances.slice(-500),
		summary: { text: s.summary.text, topics: s.summary.topics, updatedAt: s.summary.updatedAt },
		claims: s.claims.filter((c) => c.status !== "dismissed").map(claimView),
		decisions: s.decisions.map((d) => ({
			id: d.id,
			text: d.text,
			rationale: d.rationale,
			utteranceSeq: d.utteranceSeq,
			createdAt: d.createdAt,
		})),
		actions: s.actions.map((a) => ({
			id: a.id,
			task: a.task,
			assignee: a.assignee,
			due: a.due,
			status: a.status,
			decidedBy: a.decidedBy,
			decisionNote: a.decisionNote,
			createdAt: a.createdAt,
		})),
		challenges: s.challenges.map((c) => ({
			id: c.id,
			topic: c.topic,
			argument: c.argument,
			question: c.question,
			createdAt: c.createdAt,
		})),
		chat: [...chat],
		recalls: s.recalls.map((r) => ({ id: r.id, memory: r.memory, when: r.when, relation: r.relation, note: r.note, createdAt: r.createdAt })),
		approvals: room.openApprovals().map(approvalView),
		agents: room.agents().map((a) => ({ id: a.id, role: a.role, name: a.name, phase: a.phase, detail: a.detail })),
		usage: usageView(room),
	}
}

export function usageView(room: Room): RoomView["usage"] {
	const u = room.usage()
	return { inputTokens: u.inputTokens, outputTokens: u.outputTokens, pressure: u.pressure }
}

function claimView(c: RoomEventPayloads["claim.resolved"]["claim"]): ClaimView {
	return {
		id: c.id,
		text: c.text,
		utteranceSeq: c.utteranceSeq,
		speakerName: c.speakerName,
		status: c.status,
		verdict: c.verdict,
		correction: c.correction,
		sources: c.sources,
		updatedAt: c.updatedAt,
	}
}

function approvalView(r: ApprovalRequest): ApprovalView {
	return { id: r.id, agentId: r.agentId, kind: r.kind, summary: r.summary, requestedAt: r.requestedAt, expiresAt: r.expiresAt }
}
