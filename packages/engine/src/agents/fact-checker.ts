import { z } from "zod"
import { composeInstruction, composePrompt, textSection, transcriptSection } from "../context/prompt"
import { detectClaims } from "../domain/signals"
import { RoomEvents } from "../events"
import { defineAgent, isEvent, type ToolDefinition } from "./definition"

const LOCK_TTL_MS = 90_000

interface FactCheckInput {
	readonly key: string
	readonly text: string
	readonly utteranceSeq: number
	readonly speakerName: string
	readonly claimId: string | null
}

const Output = z.strictObject({
	status: z
		.enum(["supported", "disputed", "refuted", "unverifiable", "not_a_claim"])
		.describe("not_a_claim = opinion, plan, joke or otherwise not a checkable factual statement."),
	verdict: z.string().describe("One sentence, max 25 words, plain language. Empty for not_a_claim."),
	correction: z.string().nullable().describe("The accurate statement when refuted or disputed, else null."),
	sources: z
		.array(z.strictObject({ title: z.string(), url: z.string() }))
		.describe("Only URLs returned by web_search that support the verdict. Max 3."),
})

export function createFactChecker(webSearch: ToolDefinition<never>) {
	return defineAgent<FactCheckInput, z.infer<typeof Output>>({
		role: "fact_checker",
		name: "Fact-Checker",
		capabilities: ["verify-claims", "web-search"],
		tier: "smart",
		maxOutputTokens: 900,
		// Claims are discrete; check two at once, keep a short backlog, drop the oldest when flooded.
		queue: { mode: "queue", concurrency: 2, maxPending: 4 },
		instruction: composeInstruction(
			"You are the Fact-Checker in a live meeting. You verify one factual claim at a time, quickly and fairly.",
			[
				"First decide if the claim is checkable. If not, answer not_a_claim without searching.",
				"Otherwise use web_search (1-3 focused queries) before deciding.",
				"supported = sources agree; disputed = credible sources disagree or it is partly wrong; refuted = clearly false; unverifiable = no reliable sources.",
				"Cite only URLs that appeared in web_search results. Never invent sources.",
				"Statements about the speakers' own team, plans, expectations, projections or internal numbers are not_a_claim.",
				"If a sentence mixes a public fact with internal context, judge only the public fact.",
				"Popular myths and 'fun facts' are exactly what you are for — check them.",
			],
		),
		output: Output,
		tools: [webSearch],
		select(event, { store, locks }) {
			if (!isEvent(event, RoomEvents.utteranceFinal)) return []
			const { utterance } = event.payload
			return detectClaims(utterance.text)
				.filter((c) => !store.findClaimByKey(c.key) && locks.isFree(`claim:${c.key}`))
				.slice(0, 2)
				.map((c) => ({
					key: c.key,
					text: c.text,
					utteranceSeq: utterance.seq,
					speakerName: utterance.speakerName,
					claimId: null,
				}))
		},
		begin(input, { store, locks, self, emit }) {
			// The lock is the coordination point: whoever holds claim:<key> owns that check.
			if (store.findClaimByKey(input.key) || !locks.tryAcquire(`claim:${input.key}`, self, LOCK_TTL_MS)) return null
			const claim = store.openClaim({ ...input, ownerId: self })
			emit(RoomEvents.claimDetected, { claim })
			return { ...input, claimId: claim.id }
		},
		prompt(input, { store }) {
			return composePrompt([
				textSection("Claim to check", `<data>\n"${input.text}" — said by ${input.speakerName}\n</data>`),
				transcriptSection("Context around the claim", store.around(input.utteranceSeq, 4)),
			])
		},
		finish(output, input, { store, locks, self, emit }) {
			if (!input.claimId) return
			const claim = store.resolveClaim(input.claimId, self, {
				status: output.status === "not_a_claim" ? "dismissed" : output.status,
				verdict: output.verdict || null,
				correction: output.correction,
				sources: output.sources.slice(0, 3),
			})
			locks.release(`claim:${input.key}`, self)
			emit(RoomEvents.claimResolved, { claim })
		},
		fail(input, { store, locks, self, emit }, reason) {
			if (!input.claimId) return
			const claim = store.resolveClaim(input.claimId, self, {
				status: "failed",
				verdict: `Could not check right now (${reason}).`,
				correction: null,
				sources: [],
			})
			locks.release(`claim:${input.key}`, self)
			emit(RoomEvents.claimResolved, { claim })
		},
	})
}
