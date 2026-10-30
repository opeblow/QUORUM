import { z } from "zod"
import { composeInstruction, composePrompt, dataSection, textSection, transcriptSection } from "../context/prompt"
import type { ConsensusRule } from "../domain/room-store"
import { RoomEvents } from "../events"
import { defineAgent } from "./definition"

const LOCK = "challenge"
const LOCK_TTL_MS = 60_000

export const DEFAULT_CONSENSUS_RULE: ConsensusRule = {
	minAgree: 3,
	minSpeakers: 2,
	windowMs: 90_000,
	cooldownMs: 120_000,
}

interface ChallengeInput {
	readonly utteranceSeq: number
}

const Output = z.strictObject({
	topic: z.string().describe("What the group is converging on, max 8 words."),
	argument: z.string().describe("The single strongest counter-argument or overlooked risk, max 45 words."),
	question: z.string().describe("One sharp question the group should answer before moving on, max 20 words."),
})

/**
 * Wakes on *room state*, not on a keyword: when agreement piles up with no pushback.
 * It also reacts to other agents — a freshly recorded decision is re-evaluated the same way.
 */
export function createDevilsAdvocate(rule: ConsensusRule = DEFAULT_CONSENSUS_RULE) {
	return defineAgent<ChallengeInput, z.infer<typeof Output>>({
		role: "devils_advocate",
		name: "Devil's Advocate",
		capabilities: ["challenge-groupthink"],
		tier: "smart",
		maxOutputTokens: 500,
		queue: { mode: "latest", concurrency: 1, maxPending: 1 },
		instruction: composeInstruction(
			"You are the Devil's Advocate in a live meeting. The group is agreeing quickly; your job is to stress-test it constructively.",
			[
				"Be specific to what was said; no generic warnings.",
				"Be respectful and brief — one argument, one question.",
				"Prefer risks with real consequences: cost, users, security, timeline, reversibility.",
			],
		),
		output: Output,
		select(event, { store, locks }) {
			if (event.type !== RoomEvents.utteranceFinal && event.type !== RoomEvents.decisionRecorded) return []
			if (!locks.isFree(LOCK) || !store.consensusWithoutDissent(rule)) return []
			return [{ utteranceSeq: store.lastSeq }]
		},
		begin(input, { store, locks, self }) {
			if (!store.consensusWithoutDissent(rule) || !locks.tryAcquire(LOCK, self, LOCK_TTL_MS)) return null
			return input
		},
		prompt(input, { store }) {
			return composePrompt([
				textSection("Meeting summary so far", store.getSummary().text || "(none yet)"),
				dataSection(
					"Decisions recorded",
					store.listDecisions().map((d) => `- ${d.text}`),
				),
				transcriptSection("Recent discussion", store.around(input.utteranceSeq, 12)),
			])
		},
		finish(output, input, { store, locks, self, emit }) {
			const challenge = store.addChallenge({ ...output, utteranceSeq: input.utteranceSeq, ownerId: self })
			locks.release(LOCK, self)
			emit(RoomEvents.challengeRaised, { challenge })
		},
		fail(_input, { locks, self }) {
			locks.release(LOCK, self)
		},
	})
}
