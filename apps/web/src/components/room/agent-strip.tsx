"use client"

import type { AgentView } from "@quorum/protocol"
import { AGENTS, isActive } from "@/lib/agents"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** Compact agent status row, used when the call takes the stage. */
export function AgentStrip({ agents }: { agents: AgentView[] }) {
	const { t } = useI18n()
	return (
		<ul className="grid grid-cols-3 gap-px sm:grid-cols-6 overflow-hidden rounded-xl border border-border bg-border">
			{agents.map((a) => {
				const meta = AGENTS[a.role]
				const Icon = meta.icon
				const active = isActive(a.phase)
				return (
					<li key={a.id} className="flex flex-col gap-1.5 bg-surface px-3 py-2.5" title={a.detail ?? undefined}>
						<span className="flex items-center gap-1.5 text-[12px] font-medium">
							<Icon className="size-3.5 shrink-0" style={{ color: meta.color }} />
							<span className="truncate">{t(`agent.${a.role}`)}</span>
						</span>
						<span className={cn("flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider", active ? "text-text" : a.phase === "paused" ? "text-warn" : "text-faint")}>
							<span className={cn("size-1.5 rounded-full", active ? "animate-pulse bg-accent" : a.phase === "paused" ? "bg-warn" : "bg-border-strong")} />
							{t(`phase.${a.phase}`)}
						</span>
					</li>
				)
			})}
		</ul>
	)
}
