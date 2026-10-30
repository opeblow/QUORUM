"use client"

import {
	PROTOCOL_VERSION,
	ServerMessage,
	type ActionView,
	type AgentView,
	type ApprovalView,
	type ChallengeView,
	type ClaimView,
	type ClientMessage,
	type DecisionView,
	type ChatView,
	type ParticipantRole,
	type RecallView,
	type SignalData,
	type RoomView,
	type SummaryView,
	type UsageView,
	type UtteranceView,
	type WireEvent,
} from "@quorum/protocol"
import { useCallback, useEffect, useReducer, useRef } from "react"

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline" | "closed"

export interface Presence {
	readonly id: string
	readonly peerId: string
	readonly name: string
	readonly role: ParticipantRole
}

export type SignalListener = (from: string, data: SignalData) => void

export interface RoomState {
	status: ConnectionStatus
	closedReason: string | null
	/** True when the host ended the meeting (vs. a connection/permission problem). */
	ended: boolean
	you: Presence | null
	lastSeq: number
	utterances: UtteranceView[]
	summary: SummaryView
	claims: ClaimView[]
	decisions: DecisionView[]
	actions: ActionView[]
	challenges: ChallengeView[]
	recalls: RecallView[]
	chat: ChatView[]
	approvals: ApprovalView[]
	agents: AgentView[]
	usage: UsageView
	participants: Presence[]
}

const initialState: RoomState = {
	status: "connecting",
	closedReason: null,
	ended: false,
	you: null,
	lastSeq: 0,
	utterances: [],
	summary: { text: "", topics: [], updatedAt: 0 },
	claims: [],
	decisions: [],
	actions: [],
	challenges: [],
	recalls: [],
	chat: [],
	approvals: [],
	agents: [],
	usage: { inputTokens: 0, outputTokens: 0, pressure: "ok" },
	participants: [],
}

type Action =
	| { type: "status"; status: ConnectionStatus; reason?: string; ended?: boolean }
	| { type: "welcome"; you: Presence; snapshot: RoomView | null; seq: number }
	| { type: "event"; seq: number; event: WireEvent }

const MAX_UTTERANCES = 600

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
	const i = list.findIndex((x) => x.id === item.id)
	if (i === -1) return [...list, item]
	const next = list.slice()
	next[i] = item
	return next
}

function applyEvent(s: RoomState, e: WireEvent): RoomState {
	switch (e.type) {
		case "utterance":
			if (s.utterances.some((u) => u.seq === e.utterance.seq)) return s
			return { ...s, utterances: [...s.utterances, e.utterance].slice(-MAX_UTTERANCES) }
		case "agent":
			return { ...s, agents: upsert(s.agents, e.agent) }
		case "claim":
			return e.claim.status === "dismissed"
				? { ...s, claims: s.claims.filter((c) => c.id !== e.claim.id) }
				: { ...s, claims: upsert(s.claims, e.claim) }
		case "decision":
			return { ...s, decisions: upsert(s.decisions, e.decision) }
		case "action":
			return { ...s, actions: upsert(s.actions, e.action) }
		case "approval.requested":
			return { ...s, approvals: upsert(s.approvals, e.approval) }
		case "approval.decided":
			return { ...s, approvals: s.approvals.filter((a) => a.id !== e.id) }
		case "challenge":
			return { ...s, challenges: upsert(s.challenges, e.challenge) }
		case "chat":
			if (s.chat.some((m) => m.id === e.message.id)) return s
			return { ...s, chat: [...s.chat, e.message].slice(-500) }
		case "recall":
			return { ...s, recalls: upsert(s.recalls, e.recall) }
		case "summary":
			return { ...s, summary: e.summary }
		case "usage":
			return { ...s, usage: e.usage }
		case "presence":
			return { ...s, participants: e.participants }
		case "agent.failed":
			return s
	}
}

function reducer(s: RoomState, a: Action): RoomState {
	switch (a.type) {
		case "status":
			return { ...s, status: a.status, closedReason: a.reason ?? s.closedReason, ended: a.ended ?? s.ended }
		case "welcome":
			if (a.snapshot) {
				const v = a.snapshot
				return {
					...s,
					status: "live",
					you: a.you,
					lastSeq: a.seq,
					utterances: v.utterances,
					summary: v.summary,
					claims: v.claims,
					decisions: v.decisions,
					actions: v.actions,
					challenges: v.challenges,
					recalls: v.recalls,
					chat: v.chat,
					approvals: v.approvals,
					agents: v.agents,
					usage: v.usage,
				}
			}
			return { ...s, status: "live", you: a.you }
		case "event":
			if (a.seq <= s.lastSeq) return s
			return { ...applyEvent(s, a.event), lastSeq: a.seq }
	}
}

const FATAL_CODES = new Set(["unauthorized", "room_closed", "room_ended", "room_full", "bad_request"])

// A stalled request or a socket that opens but never says "welcome" would otherwise leave the room
// on "Connecting" forever; both are cut off and fed into the normal backoff retry.
const TICKET_TIMEOUT_MS = 15_000
const WELCOME_TIMEOUT_MS = 15_000

async function fetchTicket(roomId: string): Promise<{ token: string; url: string }> {
	const res = await fetch(`/api/rooms/${roomId}/token`, {
		method: "POST",
		cache: "no-store",
		signal: AbortSignal.timeout(TICKET_TIMEOUT_MS),
	})
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: string }
		throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status })
	}
	return (await res.json()) as { token: string; url: string }
}

/**
 * One live connection to a room. Reconnects with jittered backoff, re-mints its ticket each time
 * (tickets are short-lived), and resumes from the last event it saw.
 */
export function useRoomConnection(roomId: string) {
	const [state, dispatch] = useReducer(reducer, initialState)
	const socketRef = useRef<WebSocket | null>(null)
	const signalListeners = useRef(new Set<SignalListener>())
	const lastSeqRef = useRef(0)
	useEffect(() => {
		lastSeqRef.current = state.lastSeq
	}, [state.lastSeq])

	useEffect(() => {
		let disposed = false
		let attempt = 0
		let retryTimer: ReturnType<typeof setTimeout> | undefined
		let pingTimer: ReturnType<typeof setInterval> | undefined
		let welcomeTimer: ReturnType<typeof setTimeout> | undefined

		const scheduleRetry = () => {
			if (disposed) return
			attempt++
			const base = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5))
			const delay = base / 2 + Math.random() * base
			dispatch({ type: "status", status: navigator.onLine ? "reconnecting" : "offline" })
			retryTimer = setTimeout(connect, delay)
		}

		async function connect() {
			if (disposed) return
			let ticket: { token: string; url: string }
			try {
				ticket = await fetchTicket(roomId)
			} catch (error) {
				const status = (error as { status?: number }).status
				if (status === 401 || status === 404 || status === 410) {
					dispatch({ type: "status", status: "closed", reason: (error as Error).message })
					return
				}
				return scheduleRetry()
			}
			if (disposed) return

			const ws = new WebSocket(ticket.url)
			socketRef.current = ws
			let fatal = false
			welcomeTimer = setTimeout(() => ws.close(), WELCOME_TIMEOUT_MS)

			ws.onopen = () => {
				const hello: ClientMessage = {
					type: "hello",
					protocol: PROTOCOL_VERSION,
					token: ticket.token,
					lastSeq: lastSeqRef.current > 0 ? lastSeqRef.current : null,
				}
				ws.send(JSON.stringify(hello))
				pingTimer = setInterval(() => {
					if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" } satisfies ClientMessage))
				}, 20_000)
			}

			ws.onmessage = (raw) => {
				let message: ServerMessage
				try {
					message = ServerMessage.parse(JSON.parse(String(raw.data)))
				} catch {
					return
				}
				if (message.type === "welcome") {
					clearTimeout(welcomeTimer)
					attempt = 0
					dispatch({ type: "welcome", you: message.you, snapshot: message.snapshot, seq: message.seq })
				} else if (message.type === "signal") {
					for (const listener of signalListeners.current) listener(message.from, message.data)
				} else if (message.type === "event") {
					dispatch({ type: "event", seq: message.seq, event: message.event })
				} else if (message.type === "error" && message.fatal && FATAL_CODES.has(message.code)) {
					fatal = true
					dispatch({ type: "status", status: "closed", reason: message.message, ended: message.code === "room_ended" })
				}
			}

			ws.onclose = () => {
				clearTimeout(welcomeTimer)
				clearInterval(pingTimer)
				if (socketRef.current === ws) socketRef.current = null
				if (!disposed && !fatal) scheduleRetry()
			}
		}

		const onOnline = () => {
			if (!socketRef.current) {
				clearTimeout(retryTimer)
				attempt = 0
				void connect()
			}
		}
		window.addEventListener("online", onOnline)
		void connect()

		return () => {
			disposed = true
			clearTimeout(retryTimer)
			clearTimeout(welcomeTimer)
			clearInterval(pingTimer)
			window.removeEventListener("online", onOnline)
			socketRef.current?.close(1000, "left")
			socketRef.current = null
		}
	}, [roomId])

	const send = useCallback((message: ClientMessage): boolean => {
		const ws = socketRef.current
		if (!ws || ws.readyState !== WebSocket.OPEN) return false
		ws.send(JSON.stringify(message))
		return true
	}, [])

	const say = useCallback((text: string) => send({ type: "say", text }), [send])
	const end = useCallback(() => send({ type: "end" }), [send])
	const chat = useCallback(
		(text: string, attachment: ChatView["attachment"] = null) => send({ type: "chat", text, attachment }),
		[send],
	)
	const sendSignal = useCallback((to: string, data: SignalData) => send({ type: "signal", to, data }), [send])
	const onSignal = useCallback((listener: SignalListener) => {
		signalListeners.current.add(listener)
		return () => {
			signalListeners.current.delete(listener)
		}
	}, [])
	const decide = useCallback(
		(approvalId: string, approved: boolean, note: string | null = null) => send({ type: "decide", approvalId, approved, note }),
		[send],
	)

	return { state, say, decide, end, chat, sendSignal, onSignal }
}
