import type { AgentView } from "@quorum/protocol"
import { BookOpenText, Gavel, History, ListChecks, Scale, SearchCheck, Sparkles, type LucideIcon } from "lucide-react"

type Role = AgentView["role"]

export interface AgentMeta {
	readonly label: string
	readonly blurb: string
	readonly icon: LucideIcon
	/** CSS colour expression for this agent's hue. */
	readonly color: string
}

export const AGENTS: Record<Role, AgentMeta> = {
	scribe: { label: "Scribe", blurb: "Keeps a running summary and topic outline.", icon: BookOpenText, color: "var(--agent-scribe)" },
	fact_checker: { label: "Fact-Checker", blurb: "Checks claims against the web while they're said.", icon: SearchCheck, color: "var(--agent-fact_checker)" },
	researcher: { label: "Researcher", blurb: "Answers open questions with sources.", icon: Sparkles, color: "var(--agent-researcher)" },
	decision_tracker: { label: "Decision Tracker", blurb: "Records what the group commits to, and why.", icon: Gavel, color: "var(--agent-decision_tracker)" },
	action_owner: { label: "Action Owner", blurb: "Turns “I'll do it” into owned, dated actions — with your approval.", icon: ListChecks, color: "var(--agent-action_owner)" },
	devils_advocate: { label: "Devil's Advocate", blurb: "Speaks up when the room agrees too fast.", icon: Scale, color: "var(--agent-devils_advocate)" },
	memory_keeper: { label: "Memory Keeper", blurb: "Remembers what your team decided in earlier meetings.", icon: History, color: "var(--agent-memory_keeper)" },
}

export const PHASE_LABEL: Record<AgentView["phase"], string> = {
	listening: "Listening",
	queued: "Queued",
	thinking: "Thinking",
	tool: "Researching",
	answering: "Writing",
	paused: "Waiting for you",
	degraded: "Degraded",
}

export function isActive(phase: AgentView["phase"]): boolean {
	return phase === "thinking" || phase === "tool" || phase === "answering" || phase === "queued"
}
