import { z } from "zod"
import { composeInstruction, composePrompt, dataSection, textSection, transcriptSection } from "../context/prompt"
import { RoomEvents } from "../events"
import { defineAgent, isEvent } from "./definition"

const MIN_NEW_UTTERANCES = 3
const MAX_STALENESS_MS = 30_000
const MAX_WINDOW = 60

interface ScribeInput {
	readonly uptoSeq: number
}

const Output = z.strictObject({
	summary: z.string().describe("Running summary of the whole meeting so far, 2-6 sentences, neutral tone."),
	topics: z.array(z.string()).describe("Ordered list of short topic labels discussed so far (max 8)."),
})

export const scribe = defineAgent<ScribeInput, z.infer<typeof Output>>({
	role: "scribe",
	name: "Scribe",
	capabilities: ["summarize", "outline"],
	tier: "fast",
	maxOutputTokens: 700,
	// Summaries supersede each other: only the newest pending request matters.
	queue: { mode: "latest", concurrency: 1, maxPending: 1, merge: (a, b) => (a.uptoSeq >= b.uptoSeq ? a : b) },
	instruction: composeInstruction("You are the Scribe in a live meeting. You keep a running summary and topic outline.", [
		"Update the previous summary with the new lines; keep everything still relevant.",
		"Never invent facts, names or numbers that were not said.",
		"Keep topic labels to 2-5 words.",
	]),
	output: Output,
	select(event, { store, now }) {
		if (!isEvent(event, RoomEvents.utteranceFinal)) return []
		const summary = store.getSummary()
		const fresh = store.lastSeq - summary.coveredSeq
		const stale = fresh > 0 && now() - summary.updatedAt > MAX_STALENESS_MS
		return fresh >= MIN_NEW_UTTERANCES || stale ? [{ uptoSeq: store.lastSeq }] : []
	},
	prompt(input, { store }) {
		const summary = store.getSummary()
		const fresh = store.since(summary.coveredSeq).filter((u) => u.seq <= input.uptoSeq).slice(-MAX_WINDOW)
		return composePrompt([
			textSection("Previous summary", summary.text || "(none yet)"),
			dataSection("Previous topics", summary.topics),
			transcriptSection("New lines", fresh),
		])
	},
	finish(output, input, { store, self, emit }) {
		const summary = store.updateSummary({
			text: output.summary,
			topics: output.topics.slice(0, 8),
			coveredSeq: input.uptoSeq,
			ownerId: self,
		})
		emit(RoomEvents.summaryUpdated, { summary })
	},
})
