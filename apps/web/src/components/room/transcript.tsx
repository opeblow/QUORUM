"use client"

import type { UtteranceView } from "@quorum/protocol"
import { ArrowUp, Mic, MicOff } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text"
import type { SpeechStatus } from "@/hooks/use-speech"
import { useI18n } from "@/lib/i18n"
import { SPEECH_LANGUAGES } from "@/lib/languages"
import { cn } from "@/lib/utils"
import { Avatar } from "./avatar"

interface Props {
	utterances: UtteranceView[]
	youId: string | null
	youName: string | null
	interim: string
	speech: { status: SpeechStatus; error: string | null; start: () => void; stop: () => void }
	onSay: (text: string) => boolean
	disabled: boolean
	lang: string
	onLang: (lang: string) => void
}

export function Transcript({ utterances, youId, youName, interim, speech, onSay, disabled, lang, onLang }: Props) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const stickRef = useRef(true)
	const [draft, setDraft] = useState("")
	const { t } = useI18n()

	// Follow new lines only while the reader is already at the bottom.
	useEffect(() => {
		const el = scrollRef.current
		if (el && stickRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
	}, [utterances.length, interim])

	function submit(event: FormEvent) {
		event.preventDefault()
		const text = draft.trim()
		if (text && onSay(text)) setDraft("")
	}

	const listening = speech.status === "listening"

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center justify-between px-5 pb-2 pt-4">
				<h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">{t("transcript.title")}</h2>
				<select
					value={lang}
					onChange={(e) => onLang(e.target.value)}
					aria-label={t("transcript.language")}
					className="max-w-[11rem] rounded-md border border-border bg-surface px-1.5 py-1 text-[12px] text-muted focus:outline-none"
				>
					{SPEECH_LANGUAGES.map((l) => (
						<option key={l.code} value={l.code}>
							{l.label}
						</option>
					))}
				</select>
			</div>
			<div
				ref={scrollRef}
				onScroll={(e) => {
					const el = e.currentTarget
					stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
				}}
				className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]"
				aria-live="polite"
				aria-label="Live transcript"
			>
				{utterances.length === 0 && !interim && (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
						<div className="grid size-12 place-items-center rounded-2xl border border-border bg-black/[0.025]">
							<Mic className="size-5 text-muted" />
						</div>
						<p className="max-w-[16rem] text-sm text-faint">{t("transcript.empty")}</p>
					</div>
				)}
				<div className="space-y-4">
					{utterances.map((u, i) => {
						const continued = utterances[i - 1]?.speakerId === u.speakerId
						const mine = u.speakerId === youId
						return (
							<motion.div
								key={u.seq}
								initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
								animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
								transition={{ duration: 0.25 }}
								className={cn("flex gap-3", continued && "-mt-2.5")}
							>
								<div className="w-7 shrink-0">{!continued && <Avatar id={u.speakerId} name={u.speakerName} />}</div>
								<div className="min-w-0">
									{!continued && (
										<p className="mb-0.5 flex items-baseline gap-2">
											<span className={cn("text-[13px] font-medium", mine ? "text-accent" : "text-text")}>{mine ? t("transcript.you") : u.speakerName}</span>
											<span className="font-mono text-[10px] text-faint">
												{new Date(u.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
											</span>
										</p>
									)}
									<p className="text-[14px] leading-relaxed text-text/80">{u.text}</p>
								</div>
							</motion.div>
						)
					})}
					{interim && (
						<div className="flex gap-3">
							<div className="w-7 shrink-0">{youId && youName && <Avatar id={youId} name={youName} className="opacity-60" />}</div>
							<AnimatedShinyText className="mx-0 text-[14px] italic leading-relaxed">{interim}…</AnimatedShinyText>
						</div>
					)}
				</div>
			</div>

			<div className="p-3">
				{speech.error && <p className="mb-2 px-1 text-xs text-warn">{speech.error}</p>}
				<form
					onSubmit={submit}
					className="glass flex items-center gap-1.5 rounded-2xl p-1.5 transition-shadow focus-within:shadow-[0_0_0_4px_rgb(0_0_0/0.06)]"
				>
					<button
						type="button"
						disabled={disabled || speech.status === "unsupported"}
						onClick={listening ? speech.stop : speech.start}
						aria-pressed={listening}
						aria-label={listening ? t("transcript.micOff") : t("transcript.micOn")}
						title={speech.status === "unsupported" ? "Live speech needs Chrome or Edge — you can still type" : undefined}
						className={cn(
							"relative grid size-10 shrink-0 place-items-center rounded-xl transition-all disabled:opacity-40",
							listening ? "bg-bad text-white" : "bg-black/[0.05] text-text hover:bg-black/[0.08]",
						)}
					>
						{listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-xl bg-bad/40" />}
						{listening ? <MicOff className="relative size-4" /> : <Mic className="size-4" />}
					</button>
					<input
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						maxLength={2000}
						placeholder={listening ? t("transcript.listening") : t("transcript.say")}
						disabled={disabled}
						aria-label="Say something"
						className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-text placeholder:text-faint focus:outline-none"
					/>
					<button
						type="submit"
						disabled={disabled || !draft.trim()}
						aria-label={t("transcript.send")}
						className="grid size-10 shrink-0 place-items-center rounded-xl bg-black text-white transition-all hover:bg-zinc-800 disabled:bg-black/[0.05] disabled:text-faint"
					>
						<ArrowUp className="size-4" />
					</button>
				</form>
			</div>
		</div>
	)
}
