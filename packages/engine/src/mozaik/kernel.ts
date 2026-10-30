import { SemanticEvent, type InterceptionHandler, type InferenceInput } from "@mozaik-ai/core"
import type { ModelPlan } from "../models"
import type { RoomEventPayloads, RoomEventType } from "../events"
import type { LoopTracker } from "./loop-tracker"
import type { RoomState } from "./room-state"
import type { ErrorReporter } from "./safe"

/** The slice of a room's runtime functions the adapter uses. */
export interface RuntimeApi {
	sendEvent(event: SemanticEvent, senderId: string): void
	runLoop(agentId: string, message: string, input: InferenceInput, interception?: InterceptionHandler): void
}

/** Everything a room's participants share, wired once per room. */
export interface RoomKernel {
	readonly roomId: string
	readonly state: RoomState
	readonly runtime: RuntimeApi
	readonly tracker: LoopTracker
	readonly models: ModelPlan
	readonly report: ErrorReporter
	readonly now: () => number
	readonly loopTimeoutMs: number
	readonly approvalTimeoutMs: number
	/** Per-room secret that proves an approval stamp came from our interception, not from model output. */
	readonly approvalSecret: string
	emit<T extends RoomEventType>(producerId: string, type: T, payload: RoomEventPayloads[T]): void
}

export function createEmitter(runtime: RuntimeApi): RoomKernel["emit"] {
	return (producerId, type, payload) => runtime.sendEvent(SemanticEvent.create(type, producerId, payload), producerId)
}
