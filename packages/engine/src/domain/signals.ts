import type { Stance } from "./types"

/**
 * Deterministic triage that runs on every utterance before any model is called.
 * It decides *which* agents are worth waking, which keeps a live room fast and affordable.
 * Recall over precision: the agent's model makes the final call, so these may over-trigger.
 */

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"“])/u

const CLAIM_MARKERS = [
	/\d/u,
	/\b(percent|million|billion|trillion|thousand|half|twice|double|triple)\b/iu,
	/\b(largest|biggest|smallest|fastest|slowest|first|oldest|newest|most|least|only|highest|lowest|best|worst)\b/iu,
	/\b(according to|studies show|research shows|statistically|on average|is the capital|was founded|was invented|fun fact|did you know|in fact|actually|visible from|can be seen|is known for|was built|was discovered|always|never)\b/iu,
]

/**
 * A capitalised word that doesn't start the sentence ("…the Great Wall of China…") usually names
 * an entity, and statements about named entities are often checkable even without numbers.
 */
const NAMED_ENTITY = /(?<!^)(?<![.!?]\s)\b(?!I\b)[A-Z][\p{Ll}]+/u
const FACT_VERB = /\b(is|are|was|were|has|have|had|can|cannot|can't|will|does|did)\b/iu

const QUESTION_START =
	/^(who|what|when|where|why|how|which|does|do|did|is|are|was|were|can|could|should|would|will|has|have|anyone know)\b/iu

const COMMITMENT =
	/\b(let'?s (go with|do|use|ship|pick|choose|move forward|stick with)|we('ll| will) (go with|use|ship|move forward)|(we )?(decided|agreed) (to|on|that)|final decision|it'?s decided|we'?re going with|go ahead with|sign(ed)? off on)\b/iu

const ACTION =
	/\b(i'?ll|i will|i can take|i'?m going to|i'?ll take|can you|could you|will you|please (send|review|update|write|prepare|check|draft|fix|ship)|action item|to-?do|follow up|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|next week|eod|end of (the )?(day|week)))\b/iu

const DISSENT =
	/\b(but|however|i disagree|not sure|concern(ed)?|worried|risk(y)?|don'?t think|wouldn'?t|problem with|push back|on the other hand|what if|downside|careful)\b/iu

const AGREE =
	/\b(agreed|agree|sounds good|makes sense|yes|yeah|yep|exactly|absolutely|love (it|that)|great idea|let'?s do it|i'?m in|totally|for sure|perfect|definitely|works for me)\b|\+1/iu

export function splitSentences(text: string): string[] {
	return text
		.split(SENTENCE_SPLIT)
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
}

export function wordCount(text: string): number {
	return text.split(/\s+/u).filter(Boolean).length
}

export function isQuestion(text: string): boolean {
	const t = text.trim()
	return t.endsWith("?") || QUESTION_START.test(t)
}

export interface ClaimCandidate {
	readonly text: string
	readonly key: string
}

export function detectClaims(text: string): ClaimCandidate[] {
	return splitSentences(text)
		.filter((s) => wordCount(s) >= 4 && !isQuestion(s))
		.filter((s) => CLAIM_MARKERS.some((re) => re.test(s)) || (NAMED_ENTITY.test(s) && FACT_VERB.test(s)))
		.map((s) => ({ text: s, key: claimKey(s) }))
}

export function hasCommitment(text: string): boolean {
	return COMMITMENT.test(text)
}

export function hasActionSignal(text: string): boolean {
	return ACTION.test(text)
}

export function classifyStance(text: string): Stance {
	// Dissent wins: "yes, but…" is pushback, not agreement.
	if (DISSENT.test(text)) return "dissent"
	if (AGREE.test(text)) return "agree"
	return "neutral"
}

export function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/gu, " ")
		.trim()
}

/** Stable short key so the same claim said twice maps to the same lock. FNV-1a, 32-bit. */
export function claimKey(text: string): string {
	let hash = 0x811c9dc5
	for (const ch of normalize(text)) {
		hash ^= ch.codePointAt(0) ?? 0
		hash = Math.imul(hash, 0x01000193) >>> 0
	}
	return hash.toString(36)
}
