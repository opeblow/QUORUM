import {
	InputTokenDetails,
	ModelContext,
	ModelMessageItem,
	OutputTokenDetails,
	TokenUsage,
	type InferenceInput,
	type InferenceOutput,
	type InferenceRunner,
} from "@mozaik-ai/core"
import { describe, expect, it } from "vitest"
import { readSignal } from "../src/mozaik/loop-signal"
import { ResilientInferenceRunner } from "../src/mozaik/resilient-runner"

const ok = (text: string): InferenceOutput => ({
	items: [ModelMessageItem.rehydrate({ text })],
	tokenUsage: new TokenUsage(1, 1, 2, new InputTokenDetails(0), new OutputTokenDetails(0)),
	rowResponse: null,
})

function runnerFrom(fn: (input: InferenceInput) => Promise<InferenceOutput>): InferenceRunner {
	return {
		run: fn,
		// eslint-disable-next-line require-yield
		async *stream() {
			throw new Error("not used")
		},
	}
}

const input = (): InferenceInput => ({ model: "a", context: ModelContext.create() })
const noSleep = () => Promise.resolve()
const signalOf = (out: InferenceOutput) => readSignal((out.items[0] as ModelMessageItem).content.text)

describe("ResilientInferenceRunner", () => {
	it("retries transient errors on the same model", async () => {
		const calls: string[] = []
		const runner = new ResilientInferenceRunner(
			runnerFrom(async (i) => {
				calls.push(i.model)
				if (calls.length === 1) throw Object.assign(new Error("overloaded"), { status: 529 })
				return ok("fine")
			}),
			{ fallbacksFor: () => ["b"], sleep: noSleep },
		)
		await expect(runner.run(input())).resolves.toMatchObject({ items: [{ type: "message" }] })
		expect(calls).toEqual(["a", "a"])
	})

	it("falls back to the next model on non-retryable errors", async () => {
		const calls: string[] = []
		const runner = new ResilientInferenceRunner(
			runnerFrom(async (i) => {
				calls.push(i.model)
				if (i.model === "a") throw Object.assign(new Error("bad key"), { status: 401 })
				return ok("from b")
			}),
			{ fallbacksFor: () => ["b"], sleep: noSleep },
		)
		await runner.run(input())
		expect(calls).toEqual(["a", "b"])
	})

	it("never throws: ends the loop with a failure signal after the last fallback", async () => {
		const runner = new ResilientInferenceRunner(
			runnerFrom(async () => ({ items: [], tokenUsage: undefined, rowResponse: null })),
			{ fallbacksFor: () => [], sleep: noSleep },
		)
		expect(signalOf(await runner.run(input()))).toMatchObject({
			kind: "failed",
			reason: expect.stringContaining("no message or tool call"),
		})
	})

	it("times out hung provider calls", async () => {
		const runner = new ResilientInferenceRunner(runnerFrom(() => new Promise(() => {})), {
			fallbacksFor: () => [],
			timeoutMs: 20,
			attemptsPerModel: 1,
		})
		expect(signalOf(await runner.run(input()))?.reason).toMatch(/no response/)
	})
})
