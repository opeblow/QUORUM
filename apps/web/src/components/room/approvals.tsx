"use client"

import type { ApprovalView } from "@quorum/protocol"
import { Check, Hand, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

/** Agent loops paused on a human decision. Unanswered requests expire as a rejection. */
export function Approvals({ approvals, onDecide }: { approvals: ApprovalView[]; onDecide: (id: string, approved: boolean) => void }) {
	const { t } = useI18n()
	return (
		<AnimatePresence initial={false}>
			{approvals.map((a) => (
				<motion.div
					key={a.id}
					initial={{ opacity: 0, height: 0, scale: 0.97 }}
					animate={{ opacity: 1, height: "auto", scale: 1 }}
					exit={{ opacity: 0, height: 0, scale: 0.97 }}
					transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
					className="overflow-hidden px-4 pt-1"
				>
					<div
						className="relative mb-3 overflow-hidden rounded-2xl border border-warn/20 bg-[linear-gradient(180deg,rgb(217_119_6/0.08),rgb(217_119_6/0.02))] p-4"
						role="alertdialog"
						aria-label="Approval needed"
					>
						<p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-warn">
							<Hand className="size-3.5" /> {t("approval.needs")}
							<Countdown expiresAt={a.expiresAt} />
						</p>
						<p className="mt-2 text-[15px] font-medium leading-snug text-text">{a.summary}</p>
						<p className="mt-1 text-[12px] text-muted">{t("approval.paused")}</p>
						<div className="mt-3.5 flex gap-2">
							<Button size="sm" variant="primary" onClick={() => onDecide(a.id, true)}>
								<Check /> {t("approval.approve")}
							</Button>
							<Button size="sm" variant="secondary" onClick={() => onDecide(a.id, false)}>
								<X /> {t("approval.reject")}
							</Button>
						</div>
					</div>
				</motion.div>
			))}
		</AnimatePresence>
	)
}

function Countdown({ expiresAt }: { expiresAt: number }) {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(t)
	}, [])
	const left = Math.max(0, Math.round((expiresAt - now) / 1000))
	return <span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 font-mono text-[10px] text-warn/90">{left}s</span>
}
