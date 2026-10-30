import { describe, expect, it } from "vitest"
import { RoomStore } from "../src/domain/room-store"
import { claimKey, classifyStance, detectClaims, hasActionSignal, hasCommitment, isQuestion } from "../src/domain/signals"

describe("signals", () => {
	it("detects checkable claims but not questions or fragments", () => {
		const claims = detectClaims("Our churn is fine. Python was created in 1991 by Guido. Is Rust faster than Go?")
		expect(claims.map((c) => c.text)).toEqual(["Python was created in 1991 by Guido."])
		expect(detectClaims("ok 5")).toEqual([])
	})

	it("catches number-free myths about named entities (regression from live run)", () => {
		const claims = detectClaims(
			"Fun fact, the Great Wall of China is visible from the Moon with the naked eye, so scale is relative.",
		)
		expect(claims).toHaveLength(1)
		expect(detectClaims("Honestly that sounds good to me.")).toEqual([])
	})

	it("keys the same claim identically regardless of punctuation and case", () => {
		expect(claimKey("Paris is the capital of France!")).toBe(claimKey("paris is the capital of   france"))
	})

	it("classifies commitments, actions, questions and stance", () => {
		expect(hasCommitment("Okay, let's go with Postgres for this.")).toBe(true)
		expect(hasCommitment("Maybe Postgres?")).toBe(false)
		expect(hasActionSignal("I'll send the deck by Friday")).toBe(true)
		expect(isQuestion("what do we ship first")).toBe(true)
		expect(classifyStance("Yes, sounds good")).toBe("agree")
		expect(classifyStance("Yes, but I'm worried about cost")).toBe("dissent")
		expect(classifyStance("The build takes ten minutes")).toBe("neutral")
	})
})

describe("RoomStore", () => {
	const rule = { minAgree: 3, minSpeakers: 2, windowMs: 60_000, cooldownMs: 30_000 }

	it("detects consensus without dissent from shared state", () => {
		let t = 0
		const store = new RoomStore("r", 100, () => t)
		const ana = { id: "ana", name: "Ana" }
		const bo = { id: "bo", name: "Bo" }
		store.appendUtterance(ana, "Let's use Postgres")
		store.appendUtterance(bo, "Agreed")
		store.appendUtterance(ana, "Yes, makes sense")
		expect(store.consensusWithoutDissent(rule)).toBe(false)
		store.appendUtterance(bo, "Sounds good")
		expect(store.consensusWithoutDissent(rule)).toBe(true)

		store.addChallenge({ topic: "db", argument: "a", question: "q", utteranceSeq: 4, ownerId: "da" })
		expect(store.consensusWithoutDissent(rule)).toBe(false)
		t = 40_000
		store.appendUtterance(ana, "Yes")
		store.appendUtterance(bo, "Yeah")
		store.appendUtterance(ana, "Agreed")
		// Agreement counted only after the last challenge; dissent resets it.
		expect(store.consensusWithoutDissent(rule)).toBe(true)
		store.appendUtterance(bo, "However the cost worries me")
		expect(store.consensusWithoutDissent(rule)).toBe(false)
	})

	it("counts the agreement streak after earlier pushback (regression from live run)", () => {
		const store = new RoomStore("r")
		store.appendUtterance({ id: "ana", name: "Ana" }, "True, but we only expect a few million rows.")
		store.appendUtterance({ id: "lena", name: "Lena" }, "Honestly Postgres sounds good to me.")
		store.appendUtterance({ id: "marko", name: "Marko" }, "Agreed.")
		expect(store.consensusWithoutDissent(rule)).toBe(false)
		store.appendUtterance({ id: "ana", name: "Ana" }, "Yes, makes sense. Let's go with Postgres.")
		expect(store.consensusWithoutDissent(rule)).toBe(true)
	})

	it("recognises a re-proposed action despite rephrasing", () => {
		const store = new RoomStore("r")
		store.proposeAction({ task: "Set up the staging database", assignee: "Marko", due: "Thursday", utteranceSeq: 1, ownerId: "ao" })
		expect(store.findSimilarAction("marko", "Set up staging database by Thursday")).toBeDefined()
		expect(store.findSimilarAction("Lena", "Set up the staging database")).toBeUndefined()
		expect(store.findSimilarAction("Marko", "Write the migration plan")).toBeUndefined()
	})

	it("enforces artifact ownership and summary ordering", () => {
		const store = new RoomStore("r")
		const claim = store.openClaim({ key: "k", text: "t", utteranceSeq: 1, speakerName: "Ana", ownerId: "fc" })
		expect(store.openClaim({ key: "k", text: "t", utteranceSeq: 2, speakerName: "Bo", ownerId: "x" })).toBe(claim)
		expect(() =>
			store.resolveClaim(claim.id, "intruder", { status: "supported", verdict: null, correction: null, sources: [] }),
		).toThrow(/owned by/)

		store.updateSummary({ text: "new", topics: [], coveredSeq: 10, ownerId: "s" })
		store.updateSummary({ text: "old", topics: [], coveredSeq: 5, ownerId: "s" })
		expect(store.getSummary().text).toBe("new")
	})
})
