import { z } from "zod"
import { composeInstruction, composePrompt, dataSection, transcriptSection } from "../context/prompt"
import { hasActionSignal } from "../domain/signals"
import { RoomEvents } from "../events"
import { defineAgent, defineTool, isEvent } from "./definition"

/** The range of lines that woke the agent; pending wake-ups merge into one wider range. */
interface ActionInput {
	readonly fromSeq: number
	readonly uptoSeq: number
}

const ProposeArgs = z.strictObject({
	task: z.string().min(3).max(200).describe("Concrete task, starting with a verb."),
	assignee: z.string().min(1).max(80).describe("Person who committed or was asked. Use the name as spoken."),
	due: z.string().nullable().describe("Due date/time as spoken (e.g. 'Friday'), or null."),
	utteranceSeq: z.number().int().describe("The [#seq] of the line where the commitment was made."),
})

/** Committing work on someone's behalf is consequential, so it always pauses for a decision. */
const proposeActionItem = defineTool({
	name: "propose_action_item",
	description: "Propose one action item for the meeting's official list. A human must approve it before it is recorded.",
	args: ProposeArgs,
	// Duplicates never reach a human: the tool declines them itself.
	requiresApproval: (args, { store }) =>
		store.findSimilarAction(args.assignee, args.task)
			? null
			: {
					kind: "action_item",
					summary: `${args.assignee}: ${args.task}${args.due ? ` (due ${args.due})` : ""}`,
					details: { ...args },
					utteranceSeq: args.utteranceSeq,
				},
	async invoke(args, { store, self, emit, approval }) {
		const duplicate = store.findSimilarAction(args.assignee, args.task)
		if (duplicate) return `Already handled as ${duplicate.id} (${duplicate.status}). Do not propose it again.`
		if (!approval) return "Not recorded: approval is required for action items."
		const proposed = store.proposeAction({ ...args, ownerId: self })
		const action = store.decideAction(
			proposed.id,
			approval.approved ? "approved" : "rejected",
			approval.decidedBy,
			approval.note,
		)
		emit(RoomEvents.actionDecided, { action })
		return approval.approved
			? `Recorded as ${action.id}.`
			: `Rejected by ${approval.decidedBy}${approval.note ? `: ${approval.note}` : ""}. Do not propose it again.`
	},
})

const Output = z.strictObject({
	proposed: z.number().int().describe("How many action items you proposed in this turn."),
	note: z.string().describe("One short sentence on what you did."),
})

export const actionOwner = defineAgent<ActionInput, z.infer<typeof Output>>({
	role: "action_owner",
	name: "Action Owner",
	capabilities: ["capture-actions"],
	tier: "fast",
	maxOutputTokens: 600,
	queue: {
		mode: "latest",
		concurrency: 1,
		maxPending: 1,
		merge: (a, b) => ({ fromSeq: Math.min(a.fromSeq, b.fromSeq), uptoSeq: Math.max(a.uptoSeq, b.uptoSeq) }),
	},
	instruction: composeInstruction(
		"You are the Action Owner in a live meeting. You turn commitments into owned, dated action items.",
		[
			"Only propose items committed (or clearly asked and accepted) in the NEW lines. Earlier context is for understanding only.",
			"Never re-propose items already handled (approved, rejected or pending).",
			"Call propose_action_item once per new item. If a call says it was already handled, move on to the next item.",
			"When done, reply with the JSON summary. If nothing new qualifies, reply with proposed = 0 without calling tools.",
		],
	),
	output: Output,
	tools: [proposeActionItem],
	select(event) {
		if (!isEvent(event, RoomEvents.utteranceFinal)) return []
		const { utterance } = event.payload
		return hasActionSignal(utterance.text) ? [{ fromSeq: utterance.seq, uptoSeq: utterance.seq }] : []
	},
	prompt(input, { store }) {
		const all = store.around(input.fromSeq, 6, input.uptoSeq - input.fromSeq)
		return composePrompt([
			dataSection(
				"Action items already handled",
				store.listActions().map((a) => `- [${a.status}] ${a.assignee}: ${a.task}`),
			),
			transcriptSection("Earlier context", all.filter((u) => u.seq < input.fromSeq)),
			transcriptSection("NEW lines to process", all.filter((u) => u.seq >= input.fromSeq)),
		])
	},
	// The tool already changed the room; the final answer is only a receipt.
	finish() {},
})
