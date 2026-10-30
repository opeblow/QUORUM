"use client"

import { Gauge, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Video, VideoOff } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import type { RemotePeer } from "@/hooks/use-call"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { initials } from "./avatar"

interface Props {
	selfName: string
	local: MediaStream | null
	camera: boolean
	mic: boolean
	screen: boolean
	dataSaver: boolean
	remotes: RemotePeer[]
	error: string | null
	onLeave: () => void
	onToggle: (kind: "camera" | "mic") => void
	onShareScreen: () => void
	onStopScreen: () => void
	onDataSaver: () => void
}

interface TileModel {
	key: string
	name: string
	stream: MediaStream | null
	camera: boolean
	mic: boolean
	screen: boolean
	self: boolean
}

export function CallStage(p: Props) {
	const { t } = useI18n()
	const inCall = p.local !== null
	const tiles: TileModel[] = [
		...(inCall ? [{ key: "self", name: `${p.selfName} (${t("call.you")})`, stream: p.local, camera: p.camera, mic: p.mic, screen: p.screen, self: true }] : []),
		...p.remotes
			.filter((r) => r.stream || r.camera || r.mic)
			.map((r) => ({ key: r.peerId, name: r.name, stream: r.stream, camera: r.camera, mic: r.mic, screen: r.screen, self: false })),
	]
	const presenter = tiles.find((t) => t.screen)
	const others = presenter ? tiles.filter((t) => t !== presenter) : tiles
	const cols = others.length <= 1 ? "grid-cols-1" : others.length <= 4 ? "grid-cols-2" : others.length <= 9 ? "grid-cols-3" : "grid-cols-4"

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#111110] p-3 text-white">
			{presenter ? (
				<div className="flex min-h-0 flex-1 flex-col gap-3">
					<div className="min-h-0 flex-1">
						<Tile {...presenter} large />
					</div>
					{others.length > 0 && (
						<div className="flex h-28 shrink-0 gap-3 overflow-x-auto">
							{others.map(({ key, ...t }) => (
								<div key={key} className="aspect-video h-full shrink-0">
									<Tile {...t} />
								</div>
							))}
						</div>
					)}
				</div>
			) : (
				<div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-3", cols)}>
					{others.map(({ key, ...t }) => (
						<Tile key={key} {...t} />
					))}
				</div>
			)}

			{inCall && (
				<div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-2">
					<Control on={p.mic} label={p.mic ? t("call.mute") : t("call.unmute")} onClick={() => p.onToggle("mic")}>
						{p.mic ? <Mic /> : <MicOff />}
					</Control>
					<Control on={p.camera} label={p.camera ? t("call.cameraOff") : t("call.cameraOn")} onClick={() => p.onToggle("camera")}>
						{p.camera ? <Video /> : <VideoOff />}
					</Control>
					<Control
						on={!p.screen}
						accent={p.screen}
						label={p.screen ? t("call.stopShare") : t("call.share")}
						onClick={p.screen ? p.onStopScreen : p.onShareScreen}
					>
						{p.screen ? <MonitorX /> : <MonitorUp />}
					</Control>
					<Control on={!p.dataSaver} accent={p.dataSaver} label={p.dataSaver ? t("call.saverOn") : t("call.saverOff")} onClick={p.onDataSaver}>
						<Gauge />
					</Control>
					<button
						onClick={p.onLeave}
						className="ml-1 inline-flex h-11 items-center gap-2 rounded-full bg-[#d93025] px-5 text-[14px] font-medium hover:bg-[#c5221f]"
					>
						<PhoneOff className="size-4" /> {t("call.leave")}
					</button>
				</div>
			)}
			{p.error && <p className="mt-2 text-center text-[13px] text-[#ff8a4c]">{p.error}</p>}
		</div>
	)
}

function Control({ on, accent, label, onClick, children }: { on: boolean; accent?: boolean; label: string; onClick: () => void; children: ReactNode }) {
	return (
		<button
			onClick={onClick}
			aria-label={label}
			title={label}
			aria-pressed={!on}
			className={cn(
				"grid size-11 place-items-center rounded-full transition-colors [&_svg]:size-[18px]",
				accent ? "bg-accent text-white" : on ? "bg-white/10 hover:bg-white/20" : "bg-[#d93025] hover:bg-[#c5221f]",
			)}
		>
			{children}
		</button>
	)
}

function Tile({ name, stream, camera, mic, screen, self, large }: Omit<TileModel, "key"> & { large?: boolean }) {
	const { t } = useI18n()
	const ref = useRef<HTMLVideoElement>(null)
	useEffect(() => {
		if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
	}, [stream])
	const showVideo = camera || screen
	return (
		<div className={cn("relative size-full min-h-[96px] overflow-hidden rounded-xl bg-[#1f1f1d]", large && "rounded-2xl")}>
			<video
				ref={ref}
				autoPlay
				playsInline
				muted={self}
				data-testid={self ? "self-video" : "remote-video"}
				className={cn("size-full", screen ? "object-contain" : "object-cover", self && !screen && "-scale-x-100", !showVideo && "invisible")}
			/>
			{!showVideo && (
				<div className="absolute inset-0 grid place-items-center">
					<span className="grid size-16 place-items-center rounded-full bg-white/10 text-[20px] font-medium">{initials(name)}</span>
				</div>
			)}
			<div className="absolute bottom-2 left-2 flex max-w-[90%] items-center gap-1.5 truncate rounded-md bg-black/55 px-2 py-1 text-[12px]">
				{!mic && <MicOff className="size-3 shrink-0 text-[#ff8a4c]" />}
				{screen && <MonitorUp className="size-3 shrink-0" />}
				<span className="truncate">{screen ? t("call.presenting", { name }) : name}</span>
			</div>
		</div>
	)
}
