import { describe, expect, it } from "vitest"
import { describeError } from "../src/mozaik/safe"

describe("describeError", () => {
	it("never lets provider auth errors echo credentials", () => {
		const providerError = Object.assign(
			new Error("401 Incorrect API key provided: OPENAI_A*************L84A. You can find your API key at https://platform.openai.com"),
			{ status: 401 },
		)
		const reason = describeError(providerError)
		expect(reason).toBe("authentication failed (HTTP 401) — check the provider API key")
		expect(reason).not.toMatch(/L84A|OPENAI_A/)
	})

	it("redacts key-shaped tokens and clips long messages", () => {
		expect(describeError(new Error("bad token sk-proj-abcdef123456 used"))).toBe("bad token [redacted] used")
		expect(describeError(new Error("x".repeat(500))).length).toBeLessThanOrEqual(160)
	})
})
