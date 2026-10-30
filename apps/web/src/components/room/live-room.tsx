"use client"

import { Square } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { useCall } from "@/hooks/use-call"
import { useRoomConnection, type ConnectionStatus } from "@/hooks/use-room-connection"
import { useSpeech } from "@/hooks/use-speech"
import { cn } from "@/lib/utils"
import { AgentStrip } from "./agent-strip"
import { Approvals } from "./approvals"
import { AvatarStack } from "./avatar"
import { CallStage } from "./call-stage"
import { CatchUp } from "./catch-up"
import { ChatPanel } from "./chat-panel"
import { InviteMenu } from "./invite-menu"
import { useI18n, type Translate } from "@/lib/i18n"
import { Constellation } from "./constellation"
import { Feed } from "./feed"
import { Transcript } from "./transcript"

type Tab = "live" | "call" | "cards"

export function LiveRoom({ roomId, title }: { roomId: string; title: string }) {
	const { state, say, decide, end, chat, sendSignal, onSignal } = useRoomConnection(roomId)
	const [panel, setPanel] = useState<"agents" | "chat">("agents")
	const { lang, setLang: setUiLang, t } = useI18n()
	const router = useRouter()
	const [tab, setTab] = useState<Tab>("call")
	const live = state.status === "live"

	const onSay = useCallback(
		(text: string) => {
			const sent = say(text)
			if (!sent) toast.error(t("room.notConnected"))
			return sent
		},
		[say, t],
	)
	const speech = useSpeech((text) => onSay(text), lang)
	const { start: startSpeech, stop: stopSpeech } = speech
	const changeLang = useCallback(
		(next: string) => {
			setUiLang(next)
			// Restart recognition in the new language if it was running.
			if (speech.status === "listening") {
				stopSpeech()
				setTimeout(startSpeech, 300)
			}
		},
		[speech.status, startSpeech, stopSpeech, setUiLang],
	)

	const peers = useMemo(() => state.participants, [state.participants])
	const call = useCall({ selfPeerId: state.you?.peerId ?? null, peers, sendSignal, onSignal })

	// In a call, your microphone also feeds the transcript, so the agents hear you.
	const joinCall = useCallback(async () => {
		if (await call.join()) startSpeech()
	}, [call, startSpeech])
	const leaveCall = useCallback(() => {
		call.leave()
		stopSpeech()
	}, [call, stopSpeech])
	const toggle = useCallback(
		(kind: "camera" | "mic") => {
			if (kind === "mic") {
				if (call.mic) stopSpeech()
				else startSpeech()
			}
			call.toggle(kind)
		},
		[call, startSpeech, stopSpeech],
	)

	// Late joiners get the catch-up panel opened for them, once.
	// Decided once, the first time the room is live.
	const [lateJoin, setLateJoin] = useState<boolean | null>(null)
	if (live && lateJoin === null) setLateJoin(state.utterances.length >= 6)

	useEffect(() => {
		if (!state.ended) return
		stopSpeech()
		call.leave()
		toast.message(t("room.ended"), { description: t("room.openingRecap") })
		router.refresh()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.ended])

	if (state.status === "closed" && !state.ended) return <RoomClosed reason={state.closedReason} t={t} />

	const cardCount = state.claims.length + state.decisions.length + state.actions.length + state.challenges.length + state.recalls.length
	const stageActive = call.inCall || call.remotePeers.some((r) => r.camera || r.mic)

	return (
		<div className="flex h-dvh flex-col bg-bg">
			<header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-5">
				<Link href="/dashboard" aria-label="Back to dashboard" className="grid size-9 place-items-center rounded-lg border border-border hover:bg-surface-2">
					<Logo className="size-4" />
				</Link>
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
					<StatusLine status={state.status} t={t} />
				</div>
				<div className="hidden items-center gap-3 md:flex">
					<span className="font-mono text-[11px] text-faint" title="Tokens used by this room's agents">
						{(state.usage.inputTokens + state.usage.outputTokens).toLocaleString()} {t("room.tokens")}
					</span>
					<AvatarStack people={uniquePeople(state.participants)} />
				</div>
				<CatchUp summary={state.summary} decisions={state.decisions} actions={state.actions} autoOpen={lateJoin === true} />
				<InviteMenu roomId={roomId} title={title} />
				{state.you?.role === "host" && <EndMeetingButton onEnd={end} disabled={!live} t={t} />}
			</header>

			<nav className="flex shrink-0 gap-1 border-b border-border bg-surface p-1.5 lg:hidden" aria-label="Room views">
				{(["call", "live", "cards"] as const).map((tab2) => (
					<button
						key={tab2}
						onClick={() => setTab(tab2)}
						className={cn("flex-1 rounded-md py-2 text-[13px] font-medium", tab === tab2 ? "bg-surface-2 text-text" : "text-faint")}
					>
						{tab2 === "call" ? t("room.tab.call") : tab2 === "live" ? t("room.tab.transcript") : `${t("room.tab.cards")}${cardCount ? ` · ${cardCount}` : ""}`}
						{tab2 === "cards" && state.approvals.length > 0 && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />}
					</button>
				))}
			</nav>

			<div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(300px,0.9fr)_minmax(460px,1.5fr)_minmax(340px,1fr)]">
				<section className={cn("min-h-0 flex-col border-border bg-surface lg:flex lg:border-r", tab === "live" ? "flex" : "hidden")}>
					<Transcript
						utterances={state.utterances}
						youId={state.you?.id ?? null}
						youName={state.you?.name ?? null}
						interim={speech.interim}
						speech={speech}
						onSay={onSay}
						disabled={!live}
						lang={lang}
						onLang={changeLang}
					/>
				</section>

				<section className={cn("min-h-0 flex-col border-border lg:flex lg:border-r", tab === "call" ? "flex" : "hidden")}>
					{stageActive ? (
						<>
							<div className="min-h-0 flex-1">
								<CallStage
									selfName={state.you?.name ?? "You"}
									local={call.local}
									camera={call.camera}
									mic={call.mic}
									screen={call.screen}
									dataSaver={call.dataSaver}
									remotes={call.remotePeers}
									error={call.error}
									onLeave={leaveCall}
									onToggle={toggle}
									onShareScreen={call.shareScreen}
									onStopScreen={call.stopScreen}
									onDataSaver={call.toggleDataSaver}
								/>
							</div>
							{!call.inCall && (
								<div className="flex shrink-0 items-center justify-center gap-3 bg-[#111110] px-4 pb-3">
									<span className="text-[13px] text-white/70">{t("room.peopleOnCamera")}</span>
									<Button size="sm" variant="accent" onClick={joinCall} disabled={!live} data-testid="join-call">
										{t("room.joinCall")}
									</Button>
								</div>
							)}
							<div className="shrink-0 px-4 py-3">
								<AgentStrip agents={state.agents} />
							</div>
						</>
					) : (
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
							<div className="flex flex-1 items-center justify-center p-6">
								<div className="w-full max-w-[460px]">
									<Constellation agents={state.agents} topics={state.summary.topics} />
								</div>
							</div>
							<div className="flex shrink-0 flex-col items-center gap-2 border-t border-border bg-surface px-6 py-5 text-center">
								<p className="text-[14px] text-muted">{t("room.everyoneCanTalk")}</p>
								<Button onClick={joinCall} disabled={!live} data-testid="join-call">
									{t("room.joinWithCamera")}
								</Button>
								{call.error && <p className="text-[13px] text-bad">{call.error}</p>}
							</div>
						</div>
					)}
				</section>

				<section className={cn("min-h-0 overflow-y-auto lg:block", tab === "cards" ? "block" : "hidden")} aria-label="Agent cards">
					<div className="sticky top-0 z-10 flex gap-1 border-b border-border bg-bg/95 p-1.5" role="tablist">
						{(["agents", "chat"] as const).map((p2) => (
							<button
								key={p2}
								role="tab"
								aria-selected={panel === p2}
								onClick={() => setPanel(p2)}
								className={cn("flex-1 rounded-md py-2 text-[13px] font-medium", panel === p2 ? "bg-surface text-text shadow-[0_1px_2px_rgb(20_20_19/0.06)]" : "text-faint hover:text-muted")}
							>
								{p2 === "agents" ? `${t("room.agentWork")} · ${cardCount}` : `${t("room.chat")}${state.chat.length ? ` · ${state.chat.length}` : ""}`}
							</button>
						))}
					</div>
					{panel === "chat" ? (
						<div className="h-[calc(100%-49px)]">
							<ChatPanel roomId={roomId} messages={state.chat} youId={state.you?.id ?? null} onSend={chat} disabled={!live} />
						</div>
					) : (
					<>
					{state.summary.text && (
						<div className="border-b border-border px-5 py-4">
							<p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{t("room.summarySoFar")}</p>
							<p className="line-clamp-3 text-[13.5px] leading-relaxed text-muted">{state.summary.text}</p>
						</div>
					)}
					<div className="pt-3">
						<Approvals approvals={state.approvals} onDecide={(id, ok) => decide(id, ok)} />
						<Feed claims={state.claims} decisions={state.decisions} actions={state.actions} challenges={state.challenges} recalls={state.recalls} />
					</div>
					</>
					)}
				</section>
			</div>
		</div>
	)
}

function uniquePeople(list: Array<{ id: string; name: string }>) {
	const seen = new Map<string, { id: string; name: string }>()
	for (const p of list) seen.set(p.id, p)
	return [...seen.values()]
}

function EndMeetingButton({ onEnd, disabled, t }: { onEnd: () => boolean; disabled: boolean; t: Translate }) {
	const [confirming, setConfirming] = useState(false)
	useEffect(() => {
		if (!confirming) return
		const t = setTimeout(() => setConfirming(false), 4000)
		return () => clearTimeout(t)
	}, [confirming])
	return (
		<Button
			size="sm"
			variant={confirming ? "danger" : "ghost"}
			disabled={disabled}
			onClick={() => {
				if (!confirming) return setConfirming(true)
				if (!onEnd()) toast.error(t("room.notConnected"))
			}}
		>
			<Square /> <span className="hidden sm:inline">{confirming ? t("room.confirmEnd") : t("room.end")}</span>
		</Button>
	)
}

function StatusLine({ status, t }: { status: ConnectionStatus; t: Translate }) {
	const map: Record<ConnectionStatus, { text: string; dot: string }> = {
		connecting: { text: t("status.connecting"), dot: "bg-faint" },
		live: { text: t("status.live"), dot: "bg-accent" },
		reconnecting: { text: t("status.reconnecting"), dot: "bg-warn" },
		offline: { text: t("status.offline"), dot: "bg-bad" },
		closed: { text: t("status.closed"), dot: "bg-faint" },
	}
	const s = map[status]
	return (
		<span className="flex items-center gap-1.5 text-[12px] text-muted" role="status">
			<span className={cn("size-1.5 rounded-full", s.dot)} />
			{s.text}
		</span>
	)
}


function RoomClosed({ reason, t }: { reason: string | null; t: Translate }) {
	return (
		<main className="grid flex-1 place-items-center px-4">
			<div className="max-w-sm text-center">
				<Logo className="mx-auto size-8" />
				<h1 className="mt-5 font-display text-[36px] leading-tight">{t("room.notInRoom")}</h1>
				<p className="mt-2 text-sm text-muted">{reason ?? t("room.connectionClosed")}</p>
				<div className="mt-7 flex justify-center gap-2">
					<Button onClick={() => window.location.reload()}>{t("room.tryAgain")}</Button>
					<Button asChild variant="secondary">
						<Link href="/dashboard">{t("room.dashboard")}</Link>
					</Button>
				</div>
			</div>
		</main>
	)
}
