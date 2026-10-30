import { SemanticEvent, type InferenceInput, type InferenceOutput, type InferenceRunner } from "@mozaik-ai/core"
import { signalMessage } from "./loop-signal"
import { describeError } from "./safe"

export interface ResilientRunnerOptions {
	readonly fallbacksFor: (model: string) => readonly string[]
	readonly timeoutMs?: number
	readonly attemptsPerModel?: number
	readonly baseBackoffMs?: number
	readonly sleep?: (ms: number) => Promise<void>
	readonly onRetry?: (info: { model: string; attempt: number; reason: string }) => void
}

type Verdict = "retry" | "next-model"

/**
 * Wraps the runtime's inference runner with timeouts, jittered retries and cross-provider fallback.
 * It never throws: the runtime does not catch loop errors, so after the last fallback fails we
 * end the loop with a "failed" signal message and the agent reports it like any other answer.
 */
export class ResilientInferenceRunner implements InferenceRunner {
	private readonly timeoutMs: number
	private readonly attemptsPerModel: number
	private readonly baseBackoffMs: number
	private readonly sleep: (ms: number) => Promise<void>

	constructor(
		private readonly delegate: InferenceRunner,
		private readonly options: ResilientRunnerOptions,
	) {
		this.timeoutMs = options.timeoutMs ?? 45_000
		this.attemptsPerModel = options.attemptsPerModel ?? 2
		this.baseBackoffMs = options.baseBackoffMs ?? 400
		this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
	}

	async run(input: InferenceInput): Promise<InferenceOutput> {
		const chain = [input.model, ...this.options.fallbacksFor(input.model)]
		let lastReason = "no model available"
		for (const model of chain) {
			for (let attempt = 1; attempt <= this.attemptsPerModel; attempt++) {
				try {
					const output = await withTimeout(this.delegate.run({ ...input, model }), this.timeoutMs)
					assertUsable(output)
					return output
				} catch (error) {
					lastReason = `${model}: ${describeError(error)}`
					const verdict = classify(error)
					this.options.onRetry?.({ model, attempt, reason: lastReason })
					if (verdict === "next-model" || attempt === this.attemptsPerModel) break
					await this.sleep(this.backoff(attempt))
				}
			}
		}
		return failedOutput(lastReason)
	}

	async *stream(input: InferenceInput): AsyncGenerator<SemanticEvent> {
		try {
			yield* this.delegate.stream(input)
		} catch (error) {
			// The streaming state takes its final output from the "inference.output" event.
			yield SemanticEvent.create("inference.output", "resilient-runner", failedOutput(`${input.model}: ${describeError(error)}`))
		}
	}

	private backoff(attempt: number): number {
		const exp = this.baseBackoffMs * 2 ** (attempt - 1)
		return exp / 2 + Math.random() * exp
	}
}

function failedOutput(reason: string): InferenceOutput {
	return { items: [signalMessage("failed", reason)], tokenUsage: undefined, rowResponse: null }
}

class TimeoutError extends Error {
	override readonly name = "TimeoutError"
}

class UnusableOutputError extends Error {
	override readonly name = "UnusableOutputError"
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new TimeoutError(`no response in ${Math.round(ms / 1000)}s`)), ms)
	})
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** The loop's transition rules throw if a response has neither a message nor a tool call. */
function assertUsable(output: InferenceOutput): void {
	const usable = output.items.some(
		(item) => item.type === "function_call" || (item.type === "message" && "role" in item && item.role === "assistant"),
	)
	if (!usable) throw new UnusableOutputError("response contained no message or tool call")
}

function classify(error: unknown): Verdict {
	if (error instanceof TimeoutError || error instanceof UnusableOutputError) return "retry"
	const status = statusOf(error)
	if (status !== undefined) {
		if (status === 408 || status === 409 || status === 429 || status >= 500) return "retry"
		return "next-model"
	}
	const message = describeError(error).toLowerCase()
	if (/(econnreset|etimedout|socket|network|fetch failed|overloaded|rate limit)/u.test(message)) return "retry"
	return "next-model"
}

function statusOf(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) return undefined
	const candidate = (error as { status?: unknown; code?: unknown }).status ?? (error as { code?: unknown }).code
	return typeof candidate === "number" ? candidate : undefined
}
