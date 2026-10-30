import { z } from "zod"
import { composeInstruction, composePrompt, dataSection, textSection, transcriptSection } from "../context/prompt"
import type { TeamMemory } from "../domain/team-memory"
import { RoomEvents } from "../events"
import { defineAgent, defineTool, isEvent } from "./definition"

/** Phrases that refer back to earlier meetings. */
const RECALL_SIGNAL = /\b(last (time|week|month|meeting|quarter|sprint)|previously|we (already )?(decided|agreed|said)|remember when|as before|didn'?t we)\b/iu

export interface MemoryKeeperConfig {
	readonly memory: TeamMemory
	/** Whose memory this room reads and writes (the team / room owner). */
	readonly scope: string
	readonly roomId: string
}

interface RecallInput {
	readonly query: string
	readonly utteranceSeq: number
	readonly reason: "decision" | "reference"
}

const Output = z.strictObject({
	recalls: z
		.array(
			z.strictObject({
				memory: z.string().describe("The earlier memory, quoted as found."),
				when: z.string().nullable().describe("When it was recorded, if known (e.g. '3 Oct 2026'), else null."),
				relation: z.enum(["contradicts", "supports", "context"]),
				note: z.string().describe("One sentence on why it matters now, max 25 words."),
			}),
		)
		.describe("Only memories that genuinely bear on the current point. Empty if none."),
})

export function createMemoryKeeper(config: MemoryKeeperConfig) {
	const search = defineTool({
		name: "search_team_memory",
		description: "Search this team's memory of earlier meetings (decisions and action items). Returns matches with dates.",
		args: z.strictObject({ query: z.string().min(3).max(300) }),
		async invoke({ query }) {
			const items = await config.memory.recall(config.scope, query, 6)
			// Memories written during this same meeting aren't "earlier" — leave them out.
			const earlier = items.filter((m) => m.meta.roomId !== config.roomId && m.text)
			if (earlier.length === 0) return "No relevant memories from earlier meetings."
			return earlier.map((m, i) => `${i + 1}. ${m.text}${m.createdAt ? ` (recorded ${m.createdAt.slice(0, 10)})` : ""}`).join("\n")
		},
	})

	return defineAgent<RecallInput, z.infer<typeof Output>>({
		role: "memory_keeper",
		name: "Memory Keeper",
		capabilities: ["team-memory"],
		tier: "fast",
		maxOutputTokens: 700,
		queue: { mode: "queue", concurrency: 1, maxPending: 3 },
		instruction: composeInstruction(
			"You are the Memory Keeper in a live meeting. You connect what is being decided now with what this team decided in earlier meetings.",
			[
				"Always call search_team_memory once with a focused query before answering.",
				"contradicts = an earlier decision conflicts with the current one; supports = it's consistent; context = useful background.",
				"Only return memories that genuinely bear on the current point. Prefer an empty list over a weak match.",
				"Quote memories as found; never invent dates or decisions.",
			],
		),
		output: Output,
		tools: [search],
		select(event) {
			if (isEvent(event, RoomEvents.decisionRecorded)) {
				const { decision } = event.payload
				return [{ query: decision.text, utteranceSeq: decision.utteranceSeq, reason: "decision" }]
			}
			if (isEvent(event, RoomEvents.utteranceFinal) && RECALL_SIGNAL.test(event.payload.utterance.text)) {
				const { utterance } = event.payload
				return [{ query: utterance.text, utteranceSeq: utterance.seq, reason: "reference" }]
			}
			return []
		},
		prompt(input, { store }) {
			return composePrompt([
				textSection(
					input.reason === "decision" ? "A decision was just recorded" : "Someone referred to an earlier meeting",
					`<data>\n${input.query}\n</data>`,
				),
				dataSection(
					"Decisions in this meeting so far",
					store.listDecisions().map((d) => `- ${d.text}`),
				),
				transcriptSection("Recent discussion", store.around(input.utteranceSeq, 6)),
			])
		},
		finish(output, input, { store, self, emit }) {
			for (const r of output.recalls.slice(0, 2)) {
				const recall = store.addRecall({ ...r, utteranceSeq: input.utteranceSeq, ownerId: self })
				if (recall) emit(RoomEvents.memoryRecalled, { recall })
			}
		},
	})
}
