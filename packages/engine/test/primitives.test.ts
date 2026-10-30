import { describe, expect, it, vi } from "vitest"
import { ApprovalBroker } from "../src/domain/approval-broker"
import { LockTable } from "../src/domain/lock-table"
import { Semaphore } from "../src/domain/semaphore"
import { TokenBudget } from "../src/domain/token-budget"
import { WorkQueue } from "../src/domain/work-queue"

describe("LockTable", () => {
	it("gives a key to one owner at a time and expires leases", () => {
		let t = 0
		const locks = new LockTable(() => t)
		expect(locks.tryAcquire("claim:a", "x", 100)).toBe(true)
		expect(locks.tryAcquire("claim:a", "y", 100)).toBe(false)
		expect(locks.holder("claim:a")).toBe("x")
		expect(locks.release("claim:a", "y")).toBe(false)
		t = 150
		expect(locks.isFree("claim:a")).toBe(true)
		expect(locks.tryAcquire("claim:a", "y", 100)).toBe(true)
	})
})

describe("Semaphore", () => {
	it("caps concurrency, hands permits over FIFO and adapts its limit", async () => {
		const sem = new Semaphore(2)
		const r1 = await sem.acquire()
		const r2 = await sem.acquire()
		const order: number[] = []
		const p3 = sem.acquire().then((r) => (order.push(3), r))
		const p4 = sem.acquire().then((r) => (order.push(4), r))
		expect(sem.waiting).toBe(2)
		r1()
		r1() // double release is a no-op
		const r3 = await p3
		expect(sem.active).toBe(2)
		sem.setLimit(1)
		r2()
		await Promise.resolve()
		expect(order).toEqual([3])
		r3()
		;(await p4)()
		expect(order).toEqual([3, 4])
		expect(sem.active).toBe(0)
	})
})

describe("WorkQueue", () => {
	it("latest mode coalesces pending work", async () => {
		const seen: number[] = []
		let unblock!: () => void
		const gate = new Promise<void>((r) => (unblock = r))
		const q = new WorkQueue<number>(
			async (n) => {
				seen.push(n)
				if (n === 1) await gate
			},
			{ mode: "latest", concurrency: 1, maxPending: 1, merge: (a, b) => Math.max(a, b) },
		)
		q.submit(1)
		q.submit(2)
		q.submit(5)
		q.submit(3)
		unblock()
		await vi.waitFor(() => expect(seen).toEqual([1, 5]))
	})

	it("queue mode drops the oldest when full and survives worker errors", async () => {
		const seen: number[] = []
		const dropped: number[] = []
		let unblock!: () => void
		const gate = new Promise<void>((r) => (unblock = r))
		const q = new WorkQueue<number>(
			async (n) => {
				seen.push(n)
				if (n === 1) await gate
				if (n === 3) throw new Error("boom")
			},
			{ mode: "queue", concurrency: 1, maxPending: 2, onDrop: (n) => dropped.push(n) },
		)
		for (const n of [1, 2, 3, 4]) q.submit(n)
		expect(dropped).toEqual([2])
		unblock()
		await vi.waitFor(() => expect(seen).toEqual([1, 3, 4]))
	})
})

describe("TokenBudget", () => {
	it("reports pressure transitions", () => {
		const b = new TokenBudget({ softTokens: 100, hardTokens: 200 })
		expect(b.record({ agentId: "a", model: "m", inputTokens: 50, outputTokens: 10 })).toBe("ok")
		expect(b.record({ agentId: "a", model: "m", inputTokens: 50, outputTokens: 0 })).toBe("soft")
		expect(b.record({ agentId: "b", model: "m", inputTokens: 100, outputTokens: 0 })).toBe("hard")
		expect(b.snapshot().byAgent).toEqual({ a: 110, b: 100 })
	})
})

describe("ApprovalBroker", () => {
	it("first decision wins and silence means rejection", async () => {
		vi.useFakeTimers()
		try {
			const broker = new ApprovalBroker()
			const base = { agentId: "a", kind: "k", summary: "s", details: {}, utteranceSeq: 1 }
			const first = broker.request({ ...base, id: "1" }, 1000)
			expect(broker.decide("1", { approved: true, decidedBy: "Ana", note: null })).toBe(true)
			expect(broker.decide("1", { approved: false, decidedBy: "Bo", note: null })).toBe(false)
			await expect(first.decision).resolves.toMatchObject({ approved: true, decidedBy: "Ana" })

			const second = broker.request({ ...base, id: "2" }, 1000)
			vi.advanceTimersByTime(1001)
			await expect(second.decision).resolves.toMatchObject({ approved: false, decidedBy: "timeout" })
			expect(broker.open()).toHaveLength(0)
		} finally {
			vi.useRealTimers()
		}
	})
})
