export type AgentRole =
	| "scribe"
	| "fact_checker"
	| "decision_tracker"
	| "action_owner"
	| "devils_advocate"
	| "researcher"
	| "memory_keeper"

/** What an agent is doing right now — drives the live constellation in the UI. */
export type AgentPhase = "listening" | "queued" | "thinking" | "tool" | "answering" | "paused" | "degraded"

export interface Speaker {
	readonly id: string
	readonly name: string
}

export interface Utterance {
	readonly seq: number
	readonly speakerId: string
	readonly speakerName: string
	readonly text: string
	readonly at: number
}

export type Stance = "agree" | "dissent" | "neutral"

export interface Source {
	readonly title: string
	readonly url: string
}

/** "dismissed" = the model judged it opinion or not checkable; the UI hides it. */
export type ClaimStatus = "checking" | "supported" | "disputed" | "refuted" | "unverifiable" | "dismissed" | "failed"

export interface Claim {
	readonly id: string
	readonly key: string
	readonly text: string
	readonly utteranceSeq: number
	readonly speakerName: string
	ownerId: string
	status: ClaimStatus
	verdict: string | null
	correction: string | null
	sources: Source[]
	readonly createdAt: number
	updatedAt: number
}

export interface Decision {
	readonly id: string
	readonly text: string
	readonly rationale: string
	readonly utteranceSeq: number
	readonly ownerId: string
	readonly createdAt: number
}

export type ActionStatus = "awaiting_approval" | "approved" | "rejected"

export interface ActionItem {
	readonly id: string
	readonly task: string
	readonly assignee: string
	readonly due: string | null
	readonly utteranceSeq: number
	readonly ownerId: string
	status: ActionStatus
	decidedBy: string | null
	decisionNote: string | null
	readonly createdAt: number
}

export interface Challenge {
	readonly id: string
	readonly topic: string
	readonly argument: string
	readonly question: string
	readonly utteranceSeq: number
	readonly ownerId: string
	readonly createdAt: number
}

export interface Summary {
	text: string
	topics: string[]
	coveredSeq: number
	updatedAt: number
	ownerId: string | null
}

/** Structural mirror of a runtime bus event, so domain code never depends on the runtime library. */
export interface RoomEvent<TPayload = unknown> {
	readonly type: string
	readonly producerId: string
	readonly occurredAt: Date
	readonly payload: TPayload
}

export type RecallRelation = "contradicts" | "supports" | "context"

/** Something from an earlier meeting that bears on what's being said now. */
export interface Recall {
	readonly id: string
	readonly memory: string
	readonly when: string | null
	readonly relation: RecallRelation
	readonly note: string
	readonly utteranceSeq: number
	readonly ownerId: string
	readonly createdAt: number
}
