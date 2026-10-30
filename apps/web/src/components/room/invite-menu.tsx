"use client"

import { Check, Copy, Link2, Mail, MessageCircle, Share2, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

/** Everything needed to bring people in: link, WhatsApp, the phone's share sheet, email. */
export function InviteMenu({ roomId, title }: { roomId: string; title: string }) {
	const [open, setOpen] = useState(false)
	const { t } = useI18n()
	const [copied, setCopied] = useState(false)
	const url = typeof window === "undefined" ? "" : `${window.location.origin}/r/${roomId}`
	const message = t("invite.message", { title, url })
	const canShare = typeof navigator !== "undefined" && "share" in navigator

	return (
		<div className="relative">
			<Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
				<Link2 /> <span className="hidden sm:inline">{t("room.invite")}</span>
			</Button>
			{open && (
				<div role="dialog" aria-label={t("invite.title")} className="absolute right-0 top-11 z-40 w-[min(92vw,360px)] rounded-xl border border-border-strong bg-surface p-4 shadow-[0_24px_48px_-16px_rgb(20_20_19/0.25)]">
					<div className="flex items-center justify-between">
						<p className="font-display text-[24px] leading-none">{t("invite.title")}</p>
						<button onClick={() => setOpen(false)} aria-label={t("common.close")} className="text-faint hover:text-text">
							<X className="size-4" />
						</button>
					</div>
					<p className="mt-2 text-[13px] text-muted">{t("invite.desc")}</p>
					<div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-1.5 pl-3">
						<span className="min-w-0 flex-1 truncate font-mono text-[12px]" data-testid="invite-url">
							{url}
						</span>
						<Button
							size="sm"
							onClick={async () => {
								await navigator.clipboard.writeText(url).catch(() => undefined)
								setCopied(true)
								setTimeout(() => setCopied(false), 1600)
							}}
						>
							{copied ? <Check /> : <Copy />} {copied ? t("invite.copied") : t("invite.copy")}
						</Button>
					</div>
					<div className="mt-3 grid grid-cols-3 gap-2">
						<a
							href={`https://wa.me/?text=${encodeURIComponent(message)}`}
							target="_blank"
							rel="noopener noreferrer"
							className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-3 text-[12px] hover:bg-surface-2"
						>
							<MessageCircle className="size-5 text-[#25d366]" /> {t("invite.whatsapp")}
						</a>
						<a
							href={`mailto:?subject=${encodeURIComponent(`Join: ${title}`)}&body=${encodeURIComponent(message)}`}
							className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-3 text-[12px] hover:bg-surface-2"
						>
							<Mail className="size-5 text-muted" /> {t("invite.email")}
						</a>
						<button
							disabled={!canShare}
							onClick={() => void navigator.share?.({ title, text: message, url }).catch(() => undefined)}
							className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-3 text-[12px] hover:bg-surface-2 disabled:opacity-40"
						>
							<Share2 className="size-5 text-muted" /> {t("invite.more")}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
