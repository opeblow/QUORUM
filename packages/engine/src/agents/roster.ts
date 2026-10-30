import type { ConsensusRule } from "../domain/room-store"
import { createWebSearchTool } from "../tools/web-search"
import { actionOwner } from "./action-owner"
import { decisionTracker } from "./decision-tracker"
import type { AnyAgentDefinition } from "./definition"
import { createDevilsAdvocate } from "./devils-advocate"
import { createFactChecker } from "./fact-checker"
import { createMemoryKeeper, type MemoryKeeperConfig } from "./memory-keeper"
import { scribe } from "./scribe"

export interface RosterConfig {
	readonly tavilyApiKey?: string | undefined
	readonly consensus?: ConsensusRule
	/** Per room: enables the Memory Keeper for this team. */
	readonly memory?: MemoryKeeperConfig | undefined
}

export interface Roster {
	readonly agents: AnyAgentDefinition[]
	/** Agents left out and why — surfaced to the user instead of silently degrading. */
	readonly disabled: Array<{ name: string; reason: string }>
}

export function defaultRoster(config: RosterConfig): Roster {
	const agents: AnyAgentDefinition[] = [scribe, decisionTracker, actionOwner, createDevilsAdvocate(config.consensus)]
	const disabled: Roster["disabled"] = []
	if (config.tavilyApiKey) {
		agents.push(createFactChecker(createWebSearchTool({ apiKey: config.tavilyApiKey })))
	} else {
		disabled.push({ name: "Fact-Checker", reason: "TAVILY_API_KEY is not set (web search required)" })
	}
	if (config.memory) agents.push(createMemoryKeeper(config.memory))
	else disabled.push({ name: "Memory Keeper", reason: "team memory not configured (MEM0_API_KEY)" })
	return { agents, disabled }
}
