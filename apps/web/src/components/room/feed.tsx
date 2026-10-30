"use client"

import type { ActionView, ChallengeView, ClaimView, DecisionView, RecallView } from "@quorum/protocol"
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleSlash, HelpCircle, XCircle } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { SpotlightCard } from "@/components/fx/spotlight-card"
import { AGENTS } from "@/lib/agents"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Item =
	| { kind: "claim"; at: number; claim: ClaimView }
	| { kind: "decision"; at: number; decision: DecisionView }
	| { kind: "action"; at: number; action: ActionView }
	| { kind: "challenge"; at: number; challenge: ChallengeView }
	| { kind: "recall"; at: number; recall: RecallView }

export function Feed(props: {
	claims: ClaimView[]
	decisions: DecisionView[]
	actions: ActionView[]
	challenges: ChallengeView[]
	recalls: RecallView[]
}) {
	const items: Item[] = [
		...props.claims.map((claim) => ({ kind: "claim" as const, at: claim.updatedAt, claim })),
		...props.decisions.map((decision) => ({ kind: "decision" as const, at: decision.createdAt, decision })),
		...props.actions.map((action) => ({ kind: "action" as const, at: action.createdAt, action })),
		...props.challenges.map((challenge) => ({ kind: "challenge" as const, at: challenge.createdAt, challenge })),
		...props.recalls.map((recall) => ({ kind: "recall" as const, at: recall.createdAt, recall })),
	].sort((a, b) => b.at - a.at)
	const { t } = useI18n()

	if (items.length === 0) {
		return (
			<div className="px-6 pt-16 text-center">
				<div className="mx-auto flex w-fit -space-x-2">
					{(["fact_checker", "decision_tracker", "action_owner", "devils_advocate"] as const).map((r) => {
						const Icon = AGENTS[r].icon
						return (
							<span key={r} className="grid size-9 place-items-center rounded-xl border border-border bg-surface-2 ring-4 ring-white">
								<Icon className="size-4" style={{ color: AGENTS[r].color }} />
							</span>
						)
					})}
				</div>
				<p className="mx-auto mt-4 max-w-[17rem] text-sm text-faint">
					{t("feed.empty")}
				</p>
			</div>
		)
	}

	return (
		<ul className="space-y-3 px-4 pb-6">
			<AnimatePresence initial={false}>
				{items.map((item) => (
					<motion.li
						key={`${item.kind}:${idOf(item)}`}
						layout
						initial={{ opacity: 0, y: -10, filter: "blur(6px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
					>
						{item.kind === "claim" && <ClaimCard claim={item.claim} />}
						{item.kind === "decision" && <DecisionCard decision={item.decision} />}
						{item.kind === "action" && <ActionCard action={item.action} />}
						{item.kind === "challenge" && <ChallengeCard challenge={item.challenge} />}
						{item.kind === "recall" && <RecallCard recall={item.recall} />}
					</motion.li>
				))}
			</AnimatePresence>
		</ul>
	)
}

function idOf(item: Item): string {
	switch (item.kind) {
		case "claim":
			return item.claim.id
		case "decision":
			return item.decision.id
		case "action":
			return item.action.id
		case "challenge":
			return item.challenge.id
		case "recall":
			return item.recall.id
	}
}

function Shell({
	role,
	label,
	children,
	tone,
}: {
	role: keyof typeof AGENTS
	label: ReactNode
	children: ReactNode
	tone?: string
}) {
	const meta = AGENTS[role]
	const Icon = meta.icon
	const color = tone ?? meta.color
	const { t } = useI18n()
	return (
		<SpotlightCard
			className="p-4 pl-5"
			style={{ boxShadow: tone ? `0 0 40px -18px ${tone}` : undefined }}
		>
			{/* Sits in the card padding (content box is inset by pl-5), never over the text. */}
			<span aria-hidden className="absolute -left-5 bottom-0 top-0 w-[3px] " style={{ background: color }} />
			<header className="mb-2.5 flex items-center gap-2 text-[11px] font-medium">
				<span className="grid size-5 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)` }}>
					<Icon className="size-3" style={{ color: meta.color }} />
				</span>
				<span style={{ color: meta.color }}>{t(`agent.${role}`)}</span>
				<span className="ml-auto">{label}</span>
			</header>
			{children}
		</SpotlightCard>
	)
}

const VERDICT = {
	checking: { icon: CircleSlash, text: "Checking", color: "var(--muted)" },
	supported: { icon: CheckCircle2, text: "Supported", color: "var(--ok)" },
	disputed: { icon: AlertTriangle, text: "Disputed", color: "var(--warn)" },
	refuted: { icon: XCircle, text: "False", color: "var(--bad)" },
	unverifiable: { icon: HelpCircle, text: "Can't verify", color: "var(--muted)" },
	failed: { icon: CircleSlash, text: "Check failed", color: "var(--faint)" },
	dismissed: { icon: CircleSlash, text: "Not a claim", color: "var(--faint)" },
} as const

function Pill({ color, children }: { color: string; children: ReactNode }) {
	return (
		<span
			className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
			style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)` }}
		>
			{children}
		</span>
	)
}

function ClaimCard({ claim }: { claim: ClaimView }) {
	const { t } = useI18n()
	const v = VERDICT[claim.status]
	const Icon = v.icon
	const checking = claim.status === "checking"
	return (
		<Shell
			role="fact_checker"
			tone={claim.status === "refuted" ? "var(--bad)" : undefined}
			label={
				checking ? (
					<span className="font-mono text-[10px] uppercase tracking-wider text-muted">{t("feed.searching")}</span>
				) : (
					<Pill color={v.color}>
						<Icon className="size-3" /> {t(`verdict.${claim.status}`)}
					</Pill>
				)
			}
		>
			<blockquote className="text-[14px] leading-relaxed text-text">
				“{claim.text}” <span className="text-[12px] text-faint">— {claim.speakerName}</span>
			</blockquote>
			{!checking && (
				<>
					{claim.verdict && <p className="mt-2 text-[13px] leading-relaxed text-muted">{claim.verdict}</p>}
					{claim.correction && (
						<p className="mt-2.5 rounded-xl border border-border bg-black/[0.025] px-3 py-2 text-[13px] leading-relaxed text-text/90">
							<span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{t("feed.correction")}</span>
							{claim.correction}
						</p>
					)}
					{claim.sources.length > 0 && (
						<ul className="mt-3 flex flex-wrap gap-1.5">
							{claim.sources.map((s) => (
								<li key={s.url}>
									<a
										href={s.url}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex max-w-[15rem] items-center gap-1 truncate rounded-full border border-border bg-black/[0.025] px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-border-strong hover:text-text"
									>
										{hostOf(s.url)} <ArrowUpRight className="size-3 shrink-0" />
									</a>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</Shell>
	)
}

function DecisionCard({ decision }: { decision: DecisionView }) {
	const { t } = useI18n()
	return (
		<Shell role="decision_tracker" label={<Pill color="var(--agent-decision_tracker)">{t("feed.decision")}</Pill>}>
			<p className="text-[15px] font-medium leading-snug text-text">{decision.text}</p>
			{decision.rationale && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{decision.rationale}</p>}
		</Shell>
	)
}

function ActionCard({ action }: { action: ActionView }) {
	const { t } = useI18n()
	const approved = action.status === "approved"
	return (
		<Shell
			role="action_owner"
			label={<Pill color={approved ? "var(--ok)" : "var(--faint)"}>{approved ? t("feed.approved") : t("feed.declined")}</Pill>}
		>
			<p className={cn("text-[14px] leading-snug", !approved && "text-faint line-through")}>
				<span className="font-semibold text-text">{action.assignee}</span> <span className="text-text/85">— {action.task}</span>
			</p>
			<p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
				{action.due && <span className="text-muted">{t("feed.due")} {action.due}</span>}
				<span>
					{approved ? t("feed.approved") : t("feed.rejected")} {t("feed.by")} {action.decidedBy}
					{action.decisionNote ? ` — ${action.decisionNote}` : ""}
				</span>
			</p>
		</Shell>
	)
}

function ChallengeCard({ challenge }: { challenge: ChallengeView }) {
	const { t } = useI18n()
	return (
		<Shell role="devils_advocate" label={<Pill color="var(--agent-devils_advocate)">{t("feed.challenge")}</Pill>}>
			<p className="text-[11px] font-medium uppercase tracking-wider text-faint">{challenge.topic}</p>
			<p className="mt-1.5 text-[13.5px] leading-relaxed text-text/85">{challenge.argument}</p>
			<p className="mt-2.5 text-[14px] font-medium leading-snug text-text">{challenge.question}</p>
		</Shell>
	)
}

const RELATION = {
	contradicts: { text: "Contradicts an earlier decision", color: "var(--bad)" },
	supports: { text: "Consistent with before", color: "var(--ok)" },
	context: { text: "From an earlier meeting", color: "var(--agent-memory_keeper)" },
} as const

function RecallCard({ recall }: { recall: RecallView }) {
	const { t } = useI18n()
	const r = RELATION[recall.relation]
	return (
		<Shell role="memory_keeper" tone={recall.relation === "contradicts" ? "var(--bad)" : undefined} label={<Pill color={r.color}>{t(`recall.${recall.relation}`)}</Pill>}>
			<p className="text-[14px] leading-relaxed text-text">{recall.memory}</p>
			{recall.when && <p className="mt-1 font-mono text-[11px] text-faint">{recall.when}</p>}
			<p className="mt-2 text-[13px] leading-relaxed text-muted">{recall.note}</p>
		</Shell>
	)
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./u, "")
	} catch {
		return url
	}
}
