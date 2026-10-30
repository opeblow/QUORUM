import { describe, expect, it } from "vitest"
import { ownerOf } from "../src/routing"

// 5000 rooms × 11 machines of sha256 is ~3s alone; under a parallel turbo run it exceeds the 5s default.
describe("rendezvous room routing", { timeout: 30_000 }, () => {
	const machines = Array.from({ length: 10 }, (_, i) => `m${i}`)
	const rooms = Array.from({ length: 5000 }, (_, i) => `room${i}`)

	it("is deterministic and order-independent", () => {
		expect(ownerOf("abc", machines)).toBe(ownerOf("abc", [...machines].reverse()))
	})

	it("spreads rooms evenly", () => {
		const counts = new Map<string, number>()
		for (const r of rooms) {
			const owner = ownerOf(r, machines)!
			counts.set(owner, (counts.get(owner) ?? 0) + 1)
		}
		for (const c of counts.values()) expect(c).toBeGreaterThan(400) // ideal 500 each
		for (const c of counts.values()) expect(c).toBeLessThan(600)
	})

	it("moves only ~1/N rooms when a machine is added", () => {
		const bigger = [...machines, "m10"]
		const moved = rooms.filter((r) => ownerOf(r, machines) !== ownerOf(r, bigger)).length
		expect(moved / rooms.length).toBeLessThan(0.13) // ideal 1/11 ≈ 9%
		// and every moved room moved to the new machine
		expect(rooms.filter((r) => ownerOf(r, machines) !== ownerOf(r, bigger)).every((r) => ownerOf(r, bigger) === "m10")).toBe(true)
	})
})
