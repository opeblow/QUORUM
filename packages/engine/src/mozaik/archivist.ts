import { createHuman, type Human, type SituationHandler } from "@mozaik-ai/core"
import type { TeamMemory } from "../domain/team-memory"
import { RoomEvents, type RoomEventPayloads } from "../events"
import type { RoomKernel } from "./kernel"
import { safeHandler } from "./safe"
import { EventIs, When } from "./specs"

export interface ArchivistConfig {
	readonly memory: TeamMemory
	readonly scope: string
	readonly roomTitle: string
}

/**
 * Rules-only participant that writes what the meeting settled into the team's long-term memory:
 * every recorded decision and every approved action item. Rejected items are never remembered.
 */
export function createArchivist(kernel: RoomKernel, config: ArchivistConfig): Human {
	const write = (text: string, kind: string) => {
		const date = new Date(kernel.now()).toISOString().slice(0, 10)
		config.memory
			.remember(config.scope, `${text} (meeting "${config.roomTitle}", ${date})`, { kind, roomId: kernel.roomId, date })
			.catch((error: unknown) => kernel.report("archivist.remember", error))
	}

	const archivist = createHuman({ name: "Archivist", capabilities: ["remember"], handlers: [] })
	const handlers: SituationHandler[] = [
			{
				specification: new EventIs(RoomEvents.decisionRecorded),
				processor: {
					apply({ event }) {
						const { decision } = event.payload as RoomEventPayloads["decision.recorded"]
						write(`Decision: ${decision.text}${decision.rationale ? ` — because ${decision.rationale}` : ""}`, "decision")
					},
				},
			},
			{
				specification: new EventIs(RoomEvents.actionDecided).and(
					new When(({ event }) => (event.payload as RoomEventPayloads["action.decided"]).action.status === "approved"),
				),
				processor: {
					apply({ event }) {
						const { action } = event.payload as RoomEventPayloads["action.decided"]
						write(`Action item: ${action.assignee} — ${action.task}${action.due ? ` (due ${action.due})` : ""}`, "action")
					},
				},
			},
	]
	archivist.setHandlers(handlers.map((h, i) => safeHandler(`Archivist#${i}`, h, kernel.report)))
	return archivist
}
