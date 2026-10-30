import { classifyStance, normalize } from "./signals"
import type {
	ActionItem,
	ActionStatus,
	Challenge,
	Claim,
	ClaimStatus,
	Decision,
	Recall,
	Source,
	Speaker,
	Stance,
	Summary,
	Utterance,
} from "./types"

export interface ConsensusRule {
	readonly minAgree: number
	readonly minSpeakers: number
	readonly windowMs: number
	/** After a challenge, stay quiet this long so the room can respond. */
	readonly cooldownMs: number
}

export interface RoomSnapshot {
	readonly roomId: string
	readonly utterances: Utterance[]
	readonly summary: Summary
	readonly claims: Claim[]
	readonly decisions: Decision[]
	readonly actions: ActionItem[]
	readonly challenges: Challenge[]
	readonly recalls: Recall[]
}

/**
 * The room's shared memory of the meeting. Pure data + invariants; no I/O, no runtime library.
 * Every artifact records the agent that owns it — only the owner mutates it.
 */
export class RoomStore {
	private seq = 0
	private idCounter = 0
	private readonly utterances: Utterance[] = []
	private readonly stances = new Map<number, Stance>()
	private readonly claims = new Map<string, Claim>()
	private readonly decisions: Decision[] = []
	private readonly actions = new Map<string, ActionItem>()
	private readonly challenges: Challenge[] = []
	private readonly recalls: Recall[] = []
	private summary: Summary = { text: "", topics: [], coveredSeq: 0, updatedAt: 0, ownerId: null }

	constructor(
		readonly roomId: string,
		private readonly maxUtterances = 2000,
		private readonly now: () => number = Date.now,
	) {}

	nextId(prefix: string): string {
		this.idCounter++
		return `${prefix}_${this.idCounter.toString(36)}`
	}

	// ── transcript ────────────────────────────────────────────────────────────

	appendUtterance(speaker: Speaker, text: string): Utterance {
		const clean = text.trim()
		if (!clean) throw new Error("Empty utterance")
		const utterance: Utterance = {
			seq: ++this.seq,
			speakerId: speaker.id,
			speakerName: speaker.name,
			text: clean,
			at: this.now(),
		}
		this.utterances.push(utterance)
		this.stances.set(utterance.seq, classifyStance(clean))
		if (this.utterances.length > this.maxUtterances) {
			const evicted = this.utterances.shift()
			if (evicted) this.stances.delete(evicted.seq)
		}
		return utterance
	}

	get lastSeq(): number {
		return this.seq
	}

	recent(count: number): Utterance[] {
		return this.utterances.slice(-count)
	}

	since(seq: number): Utterance[] {
		return this.utterances.filter((u) => u.seq > seq)
	}

	around(seq: number, before: number, after = 0): Utterance[] {
		return this.utterances.filter((u) => u.seq >= seq - before && u.seq <= seq + after)
	}

	stanceOf(seq: number): Stance {
		return this.stances.get(seq) ?? "neutral"
	}

	/**
	 * True when the room is converging without anyone pushing back — the situation the
	 * Devil's Advocate exists for. Evaluated against shared state, not a single event.
	 */
	consensusWithoutDissent(rule: ConsensusRule): boolean {
		const now = this.now()
		const lastChallenge = this.challenges.at(-1)?.createdAt
		if (lastChallenge !== undefined && now - lastChallenge < rule.cooldownMs) return false
		const from = Math.max(now - rule.windowMs, lastChallenge ?? Number.NEGATIVE_INFINITY)
		const window = this.utterances.filter((u) => u.at >= from)
		let agree = 0
		const agreeingSpeakers = new Set<string>()
		// Count the agreement streak since the latest pushback: an early "but…" that the room
		// has since moved past should not shield the conclusion from scrutiny.
		for (const u of window) {
			const stance = this.stanceOf(u.seq)
			if (stance === "dissent") {
				agree = 0
				agreeingSpeakers.clear()
			} else if (stance === "agree") {
				agree++
				agreeingSpeakers.add(u.speakerId)
			}
		}
		return agree >= rule.minAgree && agreeingSpeakers.size >= rule.minSpeakers
	}

	// ── claims ────────────────────────────────────────────────────────────────

	findClaimByKey(key: string): Claim | undefined {
		for (const claim of this.claims.values()) if (claim.key === key) return claim
		return undefined
	}

	openClaim(input: { key: string; text: string; utteranceSeq: number; speakerName: string; ownerId: string }): Claim {
		const existing = this.findClaimByKey(input.key)
		if (existing) return existing
		const at = this.now()
		const claim: Claim = {
			id: this.nextId("clm"),
			...input,
			status: "checking",
			verdict: null,
			correction: null,
			sources: [],
			createdAt: at,
			updatedAt: at,
		}
		this.claims.set(claim.id, claim)
		return claim
	}

	resolveClaim(
		id: string,
		ownerId: string,
		result: { status: Exclude<ClaimStatus, "checking">; verdict: string | null; correction: string | null; sources: Source[] },
	): Claim {
		const claim = this.claims.get(id)
		if (!claim) throw new Error(`Unknown claim ${id}`)
		if (claim.ownerId !== ownerId) throw new Error(`Claim ${id} is owned by ${claim.ownerId}`)
		claim.status = result.status
		claim.verdict = result.verdict
		claim.correction = result.correction
		claim.sources = result.sources
		claim.updatedAt = this.now()
		return claim
	}

	getClaim(id: string): Claim | undefined {
		return this.claims.get(id)
	}

	// ── decisions ─────────────────────────────────────────────────────────────

	addDecision(input: { text: string; rationale: string; utteranceSeq: number; ownerId: string }): Decision {
		const decision: Decision = { id: this.nextId("dec"), ...input, createdAt: this.now() }
		this.decisions.push(decision)
		return decision
	}

	listDecisions(): readonly Decision[] {
		return this.decisions
	}

	// ── actions ───────────────────────────────────────────────────────────────

	proposeAction(input: { task: string; assignee: string; due: string | null; utteranceSeq: number; ownerId: string }): ActionItem {
		const action: ActionItem = {
			id: this.nextId("act"),
			...input,
			status: "awaiting_approval",
			decidedBy: null,
			decisionNote: null,
			createdAt: this.now(),
		}
		this.actions.set(action.id, action)
		return action
	}

	decideAction(id: string, status: Exclude<ActionStatus, "awaiting_approval">, decidedBy: string, note: string | null): ActionItem {
		const action = this.actions.get(id)
		if (!action) throw new Error(`Unknown action ${id}`)
		action.status = status
		action.decidedBy = decidedBy
		action.decisionNote = note
		return action
	}

	listActions(): ActionItem[] {
		return [...this.actions.values()]
	}

	/** Same person + mostly the same words = the same commitment, however the model rephrased it. */
	findSimilarAction(assignee: string, task: string): ActionItem | undefined {
		const who = normalize(assignee)
		const words = significantWords(task)
		return this.listActions().find(
			(a) => normalize(a.assignee) === who && jaccard(words, significantWords(a.task)) >= 0.5,
		)
	}

	// ── challenges ────────────────────────────────────────────────────────────

	addChallenge(input: { topic: string; argument: string; question: string; utteranceSeq: number; ownerId: string }): Challenge {
		const challenge: Challenge = { id: this.nextId("chl"), ...input, createdAt: this.now() }
		this.challenges.push(challenge)
		return challenge
	}

	listChallenges(): readonly Challenge[] {
		return this.challenges
	}

	// ── recalls ───────────────────────────────────────────────────────────────

	addRecall(input: Omit<Recall, "id" | "createdAt">): Recall | null {
		// The same memory surfaced twice in one meeting is noise.
		if (this.recalls.some((r) => r.memory === input.memory)) return null
		const recall: Recall = { id: this.nextId("rcl"), ...input, createdAt: this.now() }
		this.recalls.push(recall)
		return recall
	}

	listRecalls(): readonly Recall[] {
		return this.recalls
	}

	// ── summary ───────────────────────────────────────────────────────────────

	getSummary(): Summary {
		return this.summary
	}

	updateSummary(input: { text: string; topics: string[]; coveredSeq: number; ownerId: string }): Summary {
		// Summaries can finish out of order; never let an older one overwrite a newer one.
		if (input.coveredSeq < this.summary.coveredSeq) return this.summary
		this.summary = { ...input, updatedAt: this.now() }
		return this.summary
	}

	snapshot(): RoomSnapshot {
		return {
			roomId: this.roomId,
			utterances: [...this.utterances],
			summary: { ...this.summary },
			claims: [...this.claims.values()].map((c) => ({ ...c, sources: [...c.sources] })),
			decisions: [...this.decisions],
			actions: this.listActions().map((a) => ({ ...a })),
			challenges: [...this.challenges],
			recalls: [...this.recalls],
		}
	}
}

const STOPWORDS = new Set(["the", "a", "an", "and", "or", "to", "of", "for", "by", "it", "on", "in", "up", "with", "share"])

function significantWords(text: string): Set<string> {
	return new Set(
		normalize(text)
			.split(" ")
			.filter((w) => w.length > 2 && !STOPWORDS.has(w)),
	)
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
	if (a.size === 0 && b.size === 0) return 1
	let shared = 0
	for (const w of a) if (b.has(w)) shared++
	return shared / (a.size + b.size - shared)
}
