import {
	createAgent,
	DeveloperMessageItem,
	ModelContext,
	type Agent,
	type Tool as FunctionTool,
	type SemanticEvent,
	type SituationHandler,
} from "@mozaik-ai/core"
import { z } from "zod"
import type { AgentServices, AnyAgentDefinition, ApprovalOutcome, ToolDefinition } from "../agents/definition"
import type { AgentPhase } from "../domain/types"
import { WorkQueue } from "../domain/work-queue"
import { LoopEvents, RoomEvents } from "../events"
import { APPROVAL_FIELD, createLoopInterception } from "./interception"
import { readSignal } from "./loop-signal"
import type { RoomKernel } from "./kernel"
import { LoopAbortedError } from "./loop-tracker"
import { describeError, safeHandler } from "./safe"
import { EventIs, When, fromOthers, fromSelf } from "./specs"

export interface LiveAgent {
	readonly agent: Agent
	readonly queue: WorkQueue<unknown>
}

/** Turns a declarative AgentDefinition into a live runtime participant with its own intake and loops. */
export function createAgentParticipant(kernel: RoomKernel, def: AnyAgentDefinition): LiveAgent {
	const agent = createAgent({
		name: def.name,
		capabilities: def.capabilities,
		instruction: def.instruction,
		tools: [],
		handlers: [],
	})
	const agentId = agent.getId()
	const { state } = kernel

	state.agents.set(agentId, { id: agentId, role: def.role, name: def.name, phase: "listening", detail: null })

	const setPhase = (phase: AgentPhase, detail: string | null = null): void => {
		const status = state.agents.get(agentId)
		if (!status || (status.phase === phase && status.detail === detail)) return
		status.phase = phase
		status.detail = detail
		kernel.emit(agentId, RoomEvents.agentPhase, { agentId, role: def.role, phase, detail })
	}

	const services: AgentServices = {
		self: agentId,
		store: state.store,
		locks: state.locks,
		pressure: () => state.budget.pressure(),
		now: kernel.now,
		emit: (type, payload) => kernel.emit(agentId, type, payload),
	}

	const tools = def.tools ?? []
	const functionTools = tools.map((tool) => toFunctionTool(tool, services, kernel.approvalSecret))
	const interception = createLoopInterception(kernel, { agentId, services, tools, setPhase })
	const outputSchema = toJsonSchema(def.output)

	const queue = new WorkQueue<unknown>(runWork, {
		...def.queue,
		onDrop: () => kernel.emit(agentId, RoomEvents.agentSkipped, { agentId, role: def.role, reason: "backlog full" }),
	})

	async function runWork(input: unknown): Promise<void> {
		if (state.closing) return
		const claimed: unknown = def.begin ? def.begin(input, services) : input
		if (claimed === null) return

		setPhase("queued")
		const release = await state.llm.acquire()
		const context = ModelContext.create()
		try {
			if (state.closing) throw new LoopAbortedError("room closed")
			if (state.budget.pressure() === "hard") throw new LoopAbortedError("room budget exhausted")

			context.addContextItem(DeveloperMessageItem.create(def.instruction))
			const answer = kernel.tracker.register(context.id, agentId, kernel.loopTimeoutMs)
			setPhase("thinking")
			kernel.runtime.runLoop(
				agentId,
				def.prompt(claimed, services),
				{
					model: pickModel(kernel, def),
					context,
					tools: functionTools,
					structuredOutput: { name: def.role, schema: outputSchema, strict: true },
					maxOutputTokens: def.maxOutputTokens,
				},
				interception,
			)

			const text = await answer
			const signal = readSignal(text)
			if (signal?.kind === "aborted") throw new LoopAbortedError(signal.reason)
			if (signal?.kind === "failed") throw new Error(signal.reason)
			const output = parseOutput(def.output, text)
			setPhase("answering")
			def.finish(output, claimed, services)
			setPhase("listening")
		} catch (error) {
			const reason = describeError(error)
			kernel.tracker.fail(context.id, reason)
			try {
				def.fail?.(claimed, services, reason)
			} catch (cleanupError) {
				kernel.report(`${def.name}.fail`, cleanupError)
			}
			const event = error instanceof LoopAbortedError ? RoomEvents.agentSkipped : RoomEvents.agentFailed
			kernel.emit(agentId, event, { agentId, role: def.role, reason })
			setPhase(error instanceof LoopAbortedError ? "listening" : "degraded", reason)
		} finally {
			release()
		}
	}

	// select() runs in both the specification and the processor; compute it once per event.
	const selections = new WeakMap<SemanticEvent, unknown[]>()
	const select = (event: SemanticEvent): unknown[] => {
		let picked = selections.get(event)
		if (!picked) {
			picked = state.closing ? [] : def.select(event, services)
			selections.set(event, picked)
		}
		return picked
	}

	const handlers: SituationHandler[] = [
		{
			// Intake: react to anything others publish that this agent's definition selects as work.
			specification: fromOthers().and(new When(({ event }) => select(event).length > 0)),
			processor: {
				apply({ event }) {
					for (const item of select(event)) queue.submit(item)
				},
			},
		},
		{
			specification: new EventIs(LoopEvents.messageReceivedStarted).and(fromSelf()),
			processor: {
				apply({ event }) {
					const payload = event.payload as { loopId: string; input: { context: { id: string } } }
					kernel.tracker.bindLoop(payload.loopId, payload.input.context.id)
				},
			},
		},
		{
			specification: new EventIs(LoopEvents.functionCallStarted).and(fromSelf()),
			processor: {
				apply({ event }) {
					const payload = event.payload as { call: { name: string } }
					setPhase("tool", payload.call.name)
				},
			},
		},
		{
			specification: new EventIs(LoopEvents.inferenceStarted).and(fromSelf()),
			processor: {
				apply() {
					setPhase("thinking")
				},
			},
		},
		{
			specification: new EventIs(LoopEvents.modelAnswer).and(fromSelf()),
			processor: {
				apply({ event }) {
					const payload = event.payload as { loopId: string; answer: { content: { text: string } } }
					kernel.tracker.answer(payload.loopId, payload.answer.content.text)
				},
			},
		},
	]

	agent.setHandlers(handlers.map((h, i) => safeHandler(`${def.name}#${i}`, h, kernel.report)))
	return { agent, queue }
}

function pickModel(kernel: RoomKernel, def: AnyAgentDefinition): string {
	// Adaptivity: under budget pressure, expensive agents drop to the fast tier.
	const tier = def.tier === "smart" && kernel.state.budget.pressure() !== "ok" ? "fast" : def.tier
	const model = kernel.models[tier][0]
	if (!model) throw new Error(`No model configured for tier ${tier}`)
	return model
}

function toFunctionTool(tool: ToolDefinition<never>, services: AgentServices, secret: string): FunctionTool {
	return {
		type: "function",
		name: tool.name,
		description: tool.description,
		parameters: toJsonSchema(tool.args),
		strict: false,
		async invoke(raw: unknown) {
			const record = typeof raw === "object" && raw !== null ? { ...(raw as Record<string, unknown>) } : {}
			const stamp = record[APPROVAL_FIELD]
			delete record[APPROVAL_FIELD]
			const approval = verifyStamp(stamp, secret)
			const args = tool.args.safeParse(record)
			if (!args.success) return `Invalid arguments: ${z.prettifyError(args.error)}`
			// Defence in depth: re-check here, in case a call ever reaches the tool without passing the gate.
			if (tool.requiresApproval?.(args.data, services) && !approval) {
				return "Refused: this tool requires an approval that was not granted."
			}
			return tool.invoke(args.data, { ...services, approval })
		},
	}
}

function verifyStamp(stamp: unknown, secret: string): ApprovalOutcome | null {
	if (typeof stamp !== "object" || stamp === null) return null
	const s = stamp as Record<string, unknown>
	if (s.secret !== secret || typeof s.approved !== "boolean" || typeof s.decidedBy !== "string") return null
	return { approved: s.approved, decidedBy: s.decidedBy, note: typeof s.note === "string" ? s.note : null }
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
	const json = z.toJSONSchema(schema) as Record<string, unknown>
	delete json.$schema
	return json
}

export function parseOutput<T>(schema: z.ZodType<T>, text: string): T {
	const cleaned = text
		.trim()
		.replace(/^```(?:json)?\s*/iu, "")
		.replace(/\s*```$/u, "")
	let value: unknown
	try {
		value = JSON.parse(cleaned)
	} catch {
		throw new Error("model returned non-JSON output")
	}
	const result = schema.safeParse(value)
	if (!result.success) throw new Error(`model output failed validation: ${z.prettifyError(result.error)}`)
	return result.data
}
