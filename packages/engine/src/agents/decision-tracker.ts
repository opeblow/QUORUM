import { z } from "zod"
import { composeInstruction, composePrompt, dataSection, transcriptSection } from "../context/prompt"
import { hasCommitment } from "../domain/signals"
import { RoomEvents } from "../events"
import { defineAgent, isEvent } from "./definition"

interface DecisionInput {
	readonly fromSeq: number
	readonly uptoSeq: number
}

const Output = z.strictObject({
	decisions: z
		.array(
			z.strictObject({
				text: z.string().describe("The decision as a short imperative statement, max 20 words."),
				rationale: z.string().describe("Why, as stated in the meeting. Empty string if no reason was given."),
			}),
		)
		.describe("Only NEW decisions clearly agreed in the transcript. Empty array if none."),
})

export const decisionTracker = defineAgent<DecisionInput, z.infer<typeof Output>>({
	role: "decision_tracker",
	name: "Decision Tracker",
	capabilities: ["track-decisions"],
	tier: "fast",
	maxOutputTokens: 600,
	queue: {
		mode: "latest",
		concurrency: 1,
		maxPending: 1,
		merge: (a, b) => ({ fromSeq: Math.min(a.fromSeq, b.fromSeq), uptoSeq: Math.max(a.uptoSeq, b.uptoSeq) }),
	},
	instruction: composeInstruction("You are the Decision Tracker in a live meeting. You record decisions the group commits to.", [
		"Only record decisions made in the NEW lines. Earlier context is for understanding only.",
		"A decision needs clear commitment language and no unresolved objection.",
		"Proposals, maybes and questions are not decisions.",
		"Never repeat a decision that is already recorded, even if reworded.",
	]),
	output: Output,
	select(event) {
		if (!isEvent(event, RoomEvents.utteranceFinal)) return []
		const { utterance } = event.payload
		return hasCommitment(utterance.text) ? [{ fromSeq: utterance.seq, uptoSeq: utterance.seq }] : []
	},
	prompt(input, { store }) {
		const all = store.around(input.fromSeq, 10, input.uptoSeq - input.fromSeq)
		return composePrompt([
			dataSection(
				"Already recorded decisions",
				store.listDecisions().map((d) => `- ${d.text}`),
			),
			transcriptSection("Earlier context", all.filter((u) => u.seq < input.fromSeq)),
			transcriptSection("NEW lines to process", all.filter((u) => u.seq >= input.fromSeq)),
		])
	},
	finish(output, input, { store, self, emit }) {
		for (const d of output.decisions.slice(0, 3)) {
			const decision = store.addDecision({
				text: d.text,
				rationale: d.rationale,
				utteranceSeq: input.uptoSeq,
				ownerId: self,
			})
			emit(RoomEvents.decisionRecorded, { decision })
		}
	},
})
