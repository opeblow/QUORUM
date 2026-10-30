"use client"

import type { ActionView, DecisionView, SummaryView } from "@quorum/protocol"
import { History, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

/** "What did I miss?" — the Scribe's summary plus what's been decided and assigned so far. */
export function CatchUp({
	summary,
	decisions,
	actions,
	autoOpen,
}: {
	summary: SummaryView
	decisions: DecisionView[]
	actions: ActionView[]
	autoOpen: boolean
}) {
	const [open, setOpen] = useState(autoOpen)
	const { t } = useI18n()
	// Open when autoOpen flips on (adjusting state during render, not in an effect).
	const [prevAutoOpen, setPrevAutoOpen] = useState(autoOpen)
	if (autoOpen !== prevAutoOpen) {
		setPrevAutoOpen(autoOpen)
		if (autoOpen) setOpen(true)
	}
	const approved = actions.filter((a) => a.status === "approved")
	const empty = !summary.text && decisions.length === 0 && approved.length === 0

	return (
		<div className="relative">
			<Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
				<History /> <span className="hidden sm:inline">{t("room.catchUp")}</span>
			</Button>
			{open && (
				<div role="dialog" aria-label={t("room.catchUp")} className="absolute right-0 top-11 z-40 w-[min(92vw,420px)] rounded-xl border border-border-strong bg-surface p-5 shadow-[0_24px_48px_-16px_rgb(20_20_19/0.25)]">
					<div className="flex items-start justify-between gap-4">
						<p className="font-display text-[26px] leading-none">{t("catchup.title")}</p>
						<button onClick={() => setOpen(false)} aria-label={t("common.close")} className="text-faint hover:text-text">
							<X className="size-4" />
						</button>
					</div>
					{empty ? (
						<p className="mt-4 text-[14px] text-muted">{t("catchup.nothing")}</p>
					) : (
						<div className="mt-4 space-y-4 text-[14px]">
							{summary.text && <p className="leading-relaxed text-muted">{summary.text}</p>}
							{decisions.length > 0 && (
								<div>
									<p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">{t("catchup.decided")}</p>
									<ul className="space-y-1">
										{decisions.map((d) => (
											<li key={d.id}>— {d.text}</li>
										))}
									</ul>
								</div>
							)}
							{approved.length > 0 && (
								<div>
									<p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">{t("catchup.assigned")}</p>
									<ul className="space-y-1">
										{approved.map((a) => (
											<li key={a.id}>
												— <span className="font-medium">{a.assignee}</span>: {a.task}
												{a.due ? ` (${a.due})` : ""}
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
