import { ModelMessageItem } from "@mozaik-ai/core"

/**
 * A loop must always end with a final message — a rejected loop promise inside the runtime is
 * an unhandled rejection. So when we stop a loop (interception) or give up on it (provider
 * failure), we finish it with a sentinel answer the agent participant recognises.
 */
export type LoopSignal = { readonly kind: "aborted" | "failed"; readonly reason: string }

const PREFIX = "__quorum_signal__:"

export function signalMessage(kind: LoopSignal["kind"], reason: string): ModelMessageItem {
	return ModelMessageItem.rehydrate({ text: `${PREFIX}${kind}:${reason}` })
}

export function readSignal(answer: string): LoopSignal | null {
	if (!answer.startsWith(PREFIX)) return null
	const rest = answer.slice(PREFIX.length)
	const split = rest.indexOf(":")
	const kind = rest.slice(0, split)
	if (kind !== "aborted" && kind !== "failed") return null
	return { kind, reason: rest.slice(split + 1) }
}
