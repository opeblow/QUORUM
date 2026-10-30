"use client"

import type { AgentView } from "@quorum/protocol"
import { createRef, useMemo, useRef, type RefObject } from "react"
import { AnimatedBeam } from "@/components/ui/animated-beam"
import { AGENTS, isActive } from "@/lib/agents"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const RADIUS = 39

/**
 * The agent team around the shared conversation. A beam flows from an agent into the centre only
 * while that agent is working — several beams at once is concurrency you can watch.
 */
export function Constellation({ agents, topics, compact = false }: { agents: AgentView[]; topics: string[]; compact?: boolean }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const centerRef = useRef<HTMLDivElement>(null)
	const rosterKey = agents.map((a) => a.id).join("|")
	const nodeRefs = useMemo(() => {
		const map = new Map<string, RefObject<HTMLDivElement | null>>()
		for (const a of agents) map.set(a.id, createRef<HTMLDivElement>())
		return map
		// Refs only need to change when the roster does, not on every phase update.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rosterKey])

	const working = agents.filter((a) => isActive(a.phase))
	const { t } = useI18n()

	return (
		<div ref={containerRef} className="relative mx-auto aspect-square w-full max-w-[520px]">
			<div aria-hidden className="bg-grid absolute inset-[6%] rounded-full opacity-70 [mask-image:radial-gradient(circle,black_35%,transparent_68%)]" />
			<div aria-hidden className="absolute inset-[11%] rounded-full border border-dashed border-black/[0.06]" />
			<div aria-hidden className="absolute inset-[24%] rounded-full border border-black/[0.05]" />

			{agents.map((agent) => {
				const ref = nodeRefs.get(agent.id)
				if (!ref || !isActive(agent.phase)) return null
				const color = AGENTS[agent.role].color
				return (
					<AnimatedBeam
						key={`${agent.id}-beam`}
						containerRef={containerRef}
						fromRef={ref}
						toRef={centerRef}
						curvature={0}
						pathColor="white"
						pathOpacity={0.06}
						pathWidth={1.5}
						gradientStartColor={color}
						gradientStopColor="#ffffff"
						duration={1.8}
					/>
				)
			})}

			{/* centre: the shared conversation */}
			<div className="absolute inset-[33%] grid place-items-center">
				<div ref={centerRef} className="relative grid size-full place-items-center rounded-full">
					<div
						className={cn(
							"relative grid size-full place-items-center rounded-full border border-black/[0.08] bg-[linear-gradient(180deg,#ffffff,#f4f4f5)] p-4 text-center transition-shadow duration-500",
							working.length > 0 ? "shadow-[0_20px_60px_-20px_rgb(0_0_0/0.25)]" : "shadow-[0_0_60px_-24px_rgb(0_0_0/0.12)]",
						)}
					>
						<div>
							<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
								{working.length > 0 ? (
									<span className="font-semibold text-accent">{t("orbit.working", { n: working.length })}</span>
								) : (
									t("orbit.listening")
								)}
							</p>
							{!compact && (
								<p className="mt-1.5 line-clamp-3 text-[12px] leading-snug text-muted">
									{topics.length ? topics.slice(-3).join(" · ") : t("orbit.topics")}
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{agents.map((agent, i) => (
				<AgentNode key={agent.id} nodeRef={nodeRefs.get(agent.id)} agent={agent} index={i} total={agents.length} compact={compact} />
			))}
		</div>
	)
}

function AgentNode({
	agent,
	index,
	total,
	nodeRef,
	compact,
}: {
	agent: AgentView
	index: number
	total: number
	nodeRef: RefObject<HTMLDivElement | null> | undefined
	compact: boolean
}) {
	const meta = AGENTS[agent.role]
	const Icon = meta.icon
	const { t } = useI18n()
	const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
	const active = isActive(agent.phase)
	const waiting = agent.phase === "paused"
	const degraded = agent.phase === "degraded"
	const ring = waiting ? "var(--warn)" : meta.color

	return (
		<div
			className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center"
			style={{ left: `${50 + RADIUS * Math.cos(angle)}%`, top: `${50 + RADIUS * Math.sin(angle)}%` }}
			title={agent.detail ?? undefined}
		>
			<div ref={nodeRef} className="relative">
				{(active || waiting) && (
					<span
						aria-hidden
						className="absolute -inset-2  rounded-[20px]"
						style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${ring} 45%, transparent), transparent)` }}
					/>
				)}
				<span
					className={cn(
						"relative grid place-items-center rounded-2xl border bg-[linear-gradient(180deg,#ffffff,#f4f4f5)] shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-all duration-300",
						compact ? "size-11" : "size-14",
						degraded && "opacity-50 grayscale",
					)}
					style={{
						borderColor: `color-mix(in srgb, ${ring} ${active || waiting ? 70 : 22}%, transparent)`,
						boxShadow: active || waiting ? `0 0 28px -6px ${ring}, 0 1px 2px rgb(0 0 0 / 0.06)` : undefined,
					}}
				>
					<Icon className={compact ? "size-5" : "size-6"} style={{ color: meta.color }} />
				</span>
			</div>
			{!compact && <span className="text-[11.5px] font-medium leading-none text-text/90">{t(`agent.${agent.role}`)}</span>}
			<span
				className={cn(
					"rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
					active
						? "border-black/10 bg-black/[0.05] text-text"
						: waiting
							? "border-warn/30 bg-warn/10 text-warn"
							: degraded
								? "border-bad/30 bg-bad/10 text-bad"
								: "border-transparent text-faint",
				)}
				aria-live="polite"
			>
				{t(`phase.${agent.phase}`)}
			</span>
		</div>
	)
}
