import { z } from "zod"

/**
 * The wire contract between browsers and the room server. Deliberately separate from the engine's
 * internal types: the engine can evolve freely, while this contract changes only on purpose.
 */

export const PROTOCOL_VERSION = 1

export const LIMITS = {
	// SDP offers for audio+video run ~5–15 KB.
	maxMessageBytes: 64 * 1024,
	maxUtteranceChars: 2000,
	maxNoteChars: 500,
	maxNameChars: 60,
} as const

// ── shared view shapes ────────────────────────────────────────────────────────

export const AgentPhase = z.enum(["listening", "queued", "thinking", "tool", "answering", "paused", "degraded"])
export const AgentRole = z.enum([
	"scribe",
	"fact_checker",
	"decision_tracker",
	"action_owner",
	"devils_advocate",
	"researcher",
	"memory_keeper",
])

export const AgentView = z.object({
	id: z.string(),
	role: AgentRole,
	name: z.string(),
	phase: AgentPhase,
	detail: z.string().nullable(),
})

export const UtteranceView = z.object({
	seq: z.number(),
	speakerId: z.string(),
	speakerName: z.string(),
	text: z.string(),
	at: z.number(),
})

export const SourceView = z.object({ title: z.string(), url: z.string() })

export const ClaimView = z.object({
	id: z.string(),
	text: z.string(),
	utteranceSeq: z.number(),
	speakerName: z.string(),
	status: z.enum(["checking", "supported", "disputed", "refuted", "unverifiable", "dismissed", "failed"]),
	verdict: z.string().nullable(),
	correction: z.string().nullable(),
	sources: z.array(SourceView),
	updatedAt: z.number(),
})

export const DecisionView = z.object({
	id: z.string(),
	text: z.string(),
	rationale: z.string(),
	utteranceSeq: z.number(),
	createdAt: z.number(),
})

export const ActionView = z.object({
	id: z.string(),
	task: z.string(),
	assignee: z.string(),
	due: z.string().nullable(),
	status: z.enum(["awaiting_approval", "approved", "rejected"]),
	decidedBy: z.string().nullable(),
	decisionNote: z.string().nullable(),
	createdAt: z.number(),
})

export const ChallengeView = z.object({
	id: z.string(),
	topic: z.string(),
	argument: z.string(),
	question: z.string(),
	createdAt: z.number(),
})

export const RecallView = z.object({
	id: z.string(),
	memory: z.string(),
	when: z.string().nullable(),
	relation: z.enum(["contradicts", "supports", "context"]),
	note: z.string(),
	createdAt: z.number(),
})

export const AttachmentView = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(200),
	size: z.number().int().nonnegative(),
	mime: z.string().max(120),
})

export const ChatView = z.object({
	id: z.string(),
	fromId: z.string(),
	fromName: z.string(),
	text: z.string(),
	attachment: AttachmentView.nullable(),
	at: z.number(),
})

export const ApprovalView = z.object({
	id: z.string(),
	agentId: z.string(),
	kind: z.string(),
	summary: z.string(),
	requestedAt: z.number(),
	expiresAt: z.number(),
})

export const SummaryView = z.object({
	text: z.string(),
	topics: z.array(z.string()),
	updatedAt: z.number(),
})

export const UsageView = z.object({
	inputTokens: z.number(),
	outputTokens: z.number(),
	pressure: z.enum(["ok", "soft", "hard"]),
})

export const RoomView = z.object({
	roomId: z.string(),
	utterances: z.array(UtteranceView),
	summary: SummaryView,
	claims: z.array(ClaimView),
	decisions: z.array(DecisionView),
	actions: z.array(ActionView),
	challenges: z.array(ChallengeView),
	recalls: z.array(RecallView).default([]),
	chat: z.array(ChatView).default([]),
	approvals: z.array(ApprovalView),
	agents: z.array(AgentView),
	usage: UsageView,
})

export const ParticipantRole = z.enum(["host", "guest"])

// ── events streamed to clients ────────────────────────────────────────────────

export const WireEvent = z.discriminatedUnion("type", [
	z.object({ type: z.literal("utterance"), utterance: UtteranceView }),
	z.object({ type: z.literal("agent"), agent: AgentView }),
	z.object({ type: z.literal("claim"), claim: ClaimView }),
	z.object({ type: z.literal("decision"), decision: DecisionView }),
	z.object({ type: z.literal("action"), action: ActionView }),
	z.object({ type: z.literal("approval.requested"), approval: ApprovalView }),
	z.object({
		type: z.literal("approval.decided"),
		id: z.string(),
		approved: z.boolean(),
		decidedBy: z.string(),
		note: z.string().nullable(),
	}),
	z.object({ type: z.literal("challenge"), challenge: ChallengeView }),
	z.object({ type: z.literal("recall"), recall: RecallView }),
	z.object({ type: z.literal("chat"), message: ChatView }),
	z.object({ type: z.literal("summary"), summary: SummaryView }),
	z.object({ type: z.literal("usage"), usage: UsageView }),
	z.object({ type: z.literal("agent.failed"), agentId: z.string(), reason: z.string() }),
	z.object({
		type: z.literal("presence"),
		/** One entry per open connection; `peerId` addresses that connection for calls. */
		participants: z.array(z.object({ id: z.string(), peerId: z.string(), name: z.string(), role: ParticipantRole })),
	}),
])

// ── calls (WebRTC signalling) ───────────────────────────────────────────────────

export const SignalData = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("description"), type: z.enum(["offer", "answer", "pranswer", "rollback"]), sdp: z.string().max(60_000) }),
	z.strictObject({
		kind: z.literal("candidate"),
		candidate: z.string().max(2000),
		sdpMid: z.string().max(64).nullable(),
		sdpMLineIndex: z.number().int().min(0).max(64).nullable(),
	}),
	z.strictObject({ kind: z.literal("media"), camera: z.boolean(), mic: z.boolean(), screen: z.boolean().default(false) }),
])
export type SignalData = z.infer<typeof SignalData>

// ── client → server ───────────────────────────────────────────────────────────

export const ClientMessage = z.discriminatedUnion("type", [
	z.strictObject({
		type: z.literal("hello"),
		protocol: z.literal(PROTOCOL_VERSION),
		token: z.string().min(10).max(4096),
		/** Last event seq this client saw; the server replays from there if it still can. */
		lastSeq: z.number().int().nonnegative().nullable(),
	}),
	z.strictObject({
		type: z.literal("say"),
		text: z.string().trim().min(1).max(LIMITS.maxUtteranceChars),
	}),
	z.strictObject({
		type: z.literal("decide"),
		approvalId: z.string().min(1).max(64),
		approved: z.boolean(),
		note: z.string().max(LIMITS.maxNoteChars).nullable(),
	}),
	z.strictObject({ type: z.literal("ping") }),
	/** Room chat; `attachment` references a file already uploaded to this room. */
	z.strictObject({
		type: z.literal("chat"),
		text: z.string().trim().max(LIMITS.maxUtteranceChars),
		attachment: AttachmentView.nullable(),
	}),
	/** Host only: end the meeting for everyone and finalize the recap. */
	z.strictObject({ type: z.literal("end") }),
	/** WebRTC signalling, relayed by the server to one peer in the same room. */
	z.strictObject({ type: z.literal("signal"), to: z.string().min(1).max(64), data: SignalData }),
])

// ── server → client ───────────────────────────────────────────────────────────

export const ErrorCode = z.enum([
	"bad_request",
	"unauthorized",
	"rate_limited",
	"room_full",
	"server_busy",
	"room_closed",
	"room_ended",
	"forbidden",
	"internal",
])

export const ServerMessage = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("welcome"),
		you: z.object({ id: z.string(), peerId: z.string(), name: z.string(), role: ParticipantRole }),
		/** "snapshot": full state follows; "replay": only missed events follow. */
		mode: z.enum(["snapshot", "replay"]),
		snapshot: RoomView.nullable(),
		seq: z.number(),
	}),
	z.object({ type: z.literal("event"), seq: z.number(), at: z.number(), event: WireEvent }),
	z.object({ type: z.literal("error"), code: ErrorCode, message: z.string(), fatal: z.boolean() }),
	z.object({ type: z.literal("pong") }),
	z.object({ type: z.literal("signal"), from: z.string(), data: SignalData }),
])

// ── room access tokens (minted by the web app, verified by the room server) ─────

export const RoomTokenClaims = z.object({
	/** Stable participant key; becomes the speaker id. */
	sub: z.string().min(1).max(128),
	name: z.string().min(1).max(LIMITS.maxNameChars),
	roomId: z.string().min(1).max(64),
	role: ParticipantRole,
	template: z.string().min(1).max(40),
	/** Whose long-term memory the room uses (the room owner / team). */
	memoryScope: z.string().min(1).max(128).optional(),
	title: z.string().max(120).optional(),
})

export type AgentView = z.infer<typeof AgentView>
export type UtteranceView = z.infer<typeof UtteranceView>
export type ClaimView = z.infer<typeof ClaimView>
export type DecisionView = z.infer<typeof DecisionView>
export type ActionView = z.infer<typeof ActionView>
export type ChallengeView = z.infer<typeof ChallengeView>
export type RecallView = z.infer<typeof RecallView>
export type ChatView = z.infer<typeof ChatView>
export type AttachmentView = z.infer<typeof AttachmentView>
export type ApprovalView = z.infer<typeof ApprovalView>
export type SummaryView = z.infer<typeof SummaryView>
export type UsageView = z.infer<typeof UsageView>
export type RoomView = z.infer<typeof RoomView>
export type WireEvent = z.infer<typeof WireEvent>
export type ClientMessage = z.infer<typeof ClientMessage>
export type ServerMessage = z.infer<typeof ServerMessage>
export type ErrorCode = z.infer<typeof ErrorCode>
export type RoomTokenClaims = z.infer<typeof RoomTokenClaims>
export type ParticipantRole = z.infer<typeof ParticipantRole>
