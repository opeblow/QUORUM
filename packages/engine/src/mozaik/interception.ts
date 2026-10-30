import { FunctionCallItem, type ExecutableTransition, type InterceptionHandler } from "@mozaik-ai/core"
import type { AgentServices, ToolDefinition } from "../agents/definition"
import { RoomEvents } from "../events"
import type { RoomKernel } from "./kernel"
import { signalMessage } from "./loop-signal"

/** Key under which interception stamps a verified approval onto tool-call arguments. */
export const APPROVAL_FIELD = "__quorum_approval"

interface LoopControl {
	readonly agentId: string
	readonly services: AgentServices
	readonly tools: readonly ToolDefinition<never>[]
	readonly setPhase: (phase: "paused" | "tool", detail: string | null) => void
}

/**
 * Runs before every inference and tool call of an agent's loop. Two jobs:
 * 1. Room-level control — stop a loop that was abandoned, a room that is closing, or a room out of budget.
 * 2. Approval gate — pause a consequential tool call until a human (or another agent) decides,
 *    then rewrite the call's arguments with the verified decision.
 */
export function createLoopInterception(kernel: RoomKernel, control: LoopControl): InterceptionHandler {
	return {
		isSatisfiedBy(transition) {
			return (
				transition.nextStateId === "inference" ||
				transition.nextStateId === "inference_streaming" ||
				transition.nextStateId === "function_call"
			)
		},
		async handle(transition) {
			const stop = stopReason(kernel, transition)
			if (stop) return abortTransition(stop)
			if (transition.nextStateId === "function_call") return gateToolCall(kernel, control, transition)
			return transition
		},
	}
}

function stopReason(kernel: RoomKernel, transition: ExecutableTransition): string | null {
	const contextId = contextIdOf(transition)
	if (contextId && kernel.tracker.isCancelled(contextId)) return "loop cancelled"
	if (kernel.state.closing) return "room closed"
	if (transition.nextStateId !== "function_call" && kernel.state.budget.pressure() === "hard") return "room budget exhausted"
	return null
}

async function gateToolCall(
	kernel: RoomKernel,
	control: LoopControl,
	transition: Extract<ExecutableTransition, { nextStateId: "function_call" }>,
): Promise<ExecutableTransition> {
	const { call } = transition.input
	const tool = control.tools.find((t) => t.name === call.name)
	const args = parseArgs(call.args)
	// Never trust an approval stamp the model wrote itself.
	if (args) delete args[APPROVAL_FIELD]
	const parsed = tool && args ? tool.args.safeParse(args) : null
	const spec = tool?.requiresApproval && parsed?.success ? tool.requiresApproval(parsed.data, control.services) : null
	if (!spec || !args) return withArgs(transition, args)

	const { state } = kernel
	const { request, decision } = state.approvals.request(
		{ id: state.store.nextId("apr"), agentId: control.agentId, ...spec },
		kernel.approvalTimeoutMs,
	)
	kernel.emit(control.agentId, RoomEvents.approvalRequested, { request })
	control.setPhase("paused", `awaiting approval: ${spec.summary}`)

	const outcome = await decision
	kernel.emit(control.agentId, RoomEvents.approvalDecided, {
		id: request.id,
		approved: outcome.approved,
		decidedBy: outcome.decidedBy,
		note: outcome.note,
	})
	control.setPhase("tool", call.name)

	args[APPROVAL_FIELD] = {
		approved: outcome.approved,
		decidedBy: outcome.decidedBy,
		note: outcome.note,
		secret: kernel.approvalSecret,
	}
	return withArgs(transition, args)
}

function withArgs(
	transition: Extract<ExecutableTransition, { nextStateId: "function_call" }>,
	args: Record<string, unknown> | null,
): ExecutableTransition {
	if (!args) return transition
	const { call } = transition.input
	return {
		nextStateId: "function_call",
		input: {
			...transition.input,
			call: FunctionCallItem.rehydrate({ callId: call.callId, name: call.name, args: JSON.stringify(args) }),
		},
	}
}

/** Ending a loop early = jumping straight to its final message with a sentinel the agent recognises. */
function abortTransition(reason: string): ExecutableTransition {
	return { nextStateId: "model_message", input: { answer: signalMessage("aborted", reason) } }
}

function contextIdOf(transition: ExecutableTransition): string | null {
	switch (transition.nextStateId) {
		case "inference":
		case "inference_streaming":
			return transition.input.context.id
		case "function_call":
			return transition.input.inferenceInput.context.id
		default:
			return null
	}
}

function parseArgs(raw: string): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(raw)
		return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
	} catch {
		return null
	}
}
