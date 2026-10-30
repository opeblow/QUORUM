import { randomBytes } from "node:crypto"
import { createHuman, defineRuntime, type Human, type InferenceRunner } from "@mozaik-ai/core"
import type { AnyAgentDefinition } from "../agents/definition"
import type { ApprovalRequest } from "../domain/approval-broker"
import type { RoomSnapshot } from "../domain/room-store"
import type { BudgetLimits } from "../domain/token-budget"
import type { RoomEvent, Speaker, Utterance } from "../domain/types"
import { RoomEvents } from "../events"
import { fallbacksFor, type ModelPlan } from "../models"
import { createAgentParticipant, type LiveAgent } from "./agent-participant"
import { defaultInferenceRunner } from "./default-runner"
import { createEmitter, type RoomKernel } from "./kernel"
import { LoopTracker } from "./loop-tracker"
import { createArchivist, type ArchivistConfig } from "./archivist"
import { createModerator } from "./moderator"
import { ResilientInferenceRunner } from "./resilient-runner"
import { RoomState, type AgentStatus } from "./room-state"
import { safeHandler, type ErrorReporter } from "./safe"
import { AnyEvent } from "./specs"

export interface RoomOptions {
	readonly roomId: string
	readonly agents: readonly AnyAgentDefinition[]
	readonly models: ModelPlan
	readonly budget: BudgetLimits
	readonly maxConcurrentLoops?: number
	readonly loopTimeoutMs?: number
	readonly approvalTimeoutMs?: number
	readonly inferenceTimeoutMs?: number
	/** Override the provider runner (tests use a scripted one). Defaults to the runtime's own. */
	readonly inferenceRunner?: InferenceRunner
	readonly report?: ErrorReporter
	readonly now?: () => number
	/** Team memory: when set, decisions and approved actions are archived across meetings. */
	readonly archive?: ArchivistConfig
}

export type RoomListener = (event: RoomEvent) => void

export interface Room {
	readonly id: string
	/** Feed one finalized line of speech into the room. */
	say(speaker: Speaker, text: string): Utterance
	/** A participant approves or rejects a paused proposal. */
	decide(approvalId: string, approved: boolean, by: Speaker, note?: string): void
	openApprovals(): ApprovalRequest[]
	agents(): AgentStatus[]
	/** Display name of any participant in this room (agent, human, system), or the id if unknown. */
	nameOf(participantId: string): string
	snapshot(): RoomSnapshot
	usage(): ReturnType<RoomState["budget"]["snapshot"]>
	onEvent(listener: RoomListener): () => void
	close(): void
}

/**
 * One meeting = one isolated runtime. `defineRuntime()` returns a fresh closure on every call,
 * so rooms never share participants, state or loops — this is what lets a server host many.
 */
export function createRoom(options: RoomOptions): Room {
	const now = options.now ?? Date.now
	const report: ErrorReporter = options.report ?? ((where, error) => console.error(`[room ${options.roomId}] ${where}:`, error))
	const runtimeFns = defineRuntime<RoomState>()
	const tracker = new LoopTracker()

	const runner = new ResilientInferenceRunner(
		options.inferenceRunner ?? defaultInferenceRunner(),
		{
			fallbacksFor: (model) => fallbacksFor(options.models, model),
			timeoutMs: options.inferenceTimeoutMs ?? 45_000,
		},
	)

	const state = new RoomState(options.roomId, {
		budget: options.budget,
		maxConcurrentLoops: options.maxConcurrentLoops ?? 4,
		now,
	})
	runtimeFns.initializeRuntime({ state, inferenceRunnerConfig: { runner } })

	const kernel: RoomKernel = {
		roomId: options.roomId,
		state,
		runtime: runtimeFns,
		tracker,
		models: options.models,
		report,
		now,
		loopTimeoutMs: options.loopTimeoutMs ?? 120_000,
		approvalTimeoutMs: options.approvalTimeoutMs ?? 120_000,
		approvalSecret: randomBytes(16).toString("hex"),
		emit: createEmitter(runtimeFns),
	}

	// Observer that relays every bus event to external listeners (UI gateway, audit log, persistence).
	const listeners = new Set<RoomListener>()
	const tap = createHuman({ name: "Tap", capabilities: ["observe"], handlers: [] })
	tap.setHandlers([
		safeHandler(
			"Tap",
			{
				specification: new AnyEvent(),
				processor: {
					apply({ event }) {
						for (const listener of listeners) {
							try {
								listener(event)
							} catch (error) {
								report("listener", error)
							}
						}
					},
				},
			},
			report,
		),
	])

	runtimeFns.join(tap)
	runtimeFns.join(createModerator(kernel))
	if (options.archive) runtimeFns.join(createArchivist(kernel, options.archive))
	const live: LiveAgent[] = options.agents.map((def) => createAgentParticipant(kernel, def))
	for (const { agent } of live) runtimeFns.join(agent)

	const humans = new Map<string, Human>()
	const humanFor = (speaker: Speaker): Human => {
		let human = humans.get(speaker.id)
		if (!human) {
			human = createHuman({ name: speaker.name, capabilities: ["speak", "approve"], handlers: [] })
			humans.set(speaker.id, human)
			runtimeFns.join(human)
		}
		return human
	}

	return {
		id: options.roomId,
		say(speaker, text) {
			if (state.closing) throw new Error("Room is closed")
			const human = humanFor(speaker)
			const utterance = state.store.appendUtterance({ id: human.getId(), name: speaker.name }, text)
			kernel.emit(human.getId(), RoomEvents.utteranceFinal, { utterance })
			return utterance
		},
		decide(approvalId, approved, by, note) {
			const human = humanFor(by)
			kernel.emit(human.getId(), RoomEvents.approvalSubmitted, { id: approvalId, approved, note: note ?? null })
		},
		openApprovals: () => state.approvals.open(),
		agents: () => [...state.agents.values()].map((a) => ({ ...a })),
		nameOf: (id) => state.getParticipant(id)?.getManifest().name ?? id,
		snapshot: () => state.store.snapshot(),
		usage: () => state.budget.snapshot(),
		onEvent(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		close() {
			if (state.closing) return
			state.closing = true
			for (const { queue } of live) queue.close()
			state.approvals.rejectAll("system", "Room closed")
			tracker.failAll("room closed")
			listeners.clear()
		},
	}
}
