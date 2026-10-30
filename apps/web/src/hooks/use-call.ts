"use client"

import type { SignalData } from "@quorum/protocol"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Presence, SignalListener } from "./use-room-connection"

export interface MediaState {
	readonly camera: boolean
	readonly mic: boolean
	readonly screen: boolean
}

export interface RemotePeer extends MediaState {
	readonly peerId: string
	readonly name: string
	readonly stream: MediaStream | null
}

interface PeerConn {
	readonly pc: RTCPeerConnection
	readonly polite: boolean
	makingOffer: boolean
	ignoreOffer: boolean
}

const NO_MEDIA: MediaState = { camera: false, mic: false, screen: false }
/** Data saver: small, slow video that still shows faces on a 3G connection. */
const SAVER = { width: 640, height: 360, frameRate: 15, bitrate: 250_000 }

function iceServers(): RTCIceServer[] {
	const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]
	const turn = process.env.NEXT_PUBLIC_TURN_URLS
	if (turn) {
		servers.push({
			urls: turn.split(",").map((u) => u.trim()),
			username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
			credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
		})
	}
	return servers
}

/**
 * Mesh video call between everyone in the room, using the "perfect negotiation" pattern so either
 * side may add, remove or swap media at any time. Screen sharing swaps the outgoing video track
 * in place (no renegotiation). The room's WebSocket relays the signalling.
 */
export function useCall(opts: {
	selfPeerId: string | null
	peers: Presence[]
	sendSignal: (to: string, data: SignalData) => boolean
	onSignal: (listener: SignalListener) => () => void
}) {
	const { selfPeerId, peers, sendSignal, onSignal } = opts
	const [local, setLocal] = useState<MediaStream | null>(null)
	const [media, setMedia] = useState<MediaState>(NO_MEDIA)
	const [dataSaver, setDataSaver] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [remotes, setRemotes] = useState<Record<string, MediaState & { stream: MediaStream | null }>>({})
	const conns = useRef(new Map<string, PeerConn>())
	const localRef = useRef<MediaStream | null>(null)
	const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
	const screenTrackRef = useRef<MediaStreamTrack | null>(null)
	const mediaRef = useRef<MediaState>(NO_MEDIA)
	const saverRef = useRef(false)

	const setMediaState = useCallback((next: MediaState) => {
		mediaRef.current = next
		setMedia(next)
	}, [])

	const updateRemote = useCallback((peerId: string, patch: Partial<MediaState & { stream: MediaStream | null }>) => {
		setRemotes((r) => ({ ...r, [peerId]: { ...(r[peerId] ?? { ...NO_MEDIA, stream: null }), ...patch } }))
	}, [])

	const applyBitrate = useCallback(async (pc: RTCPeerConnection) => {
		for (const sender of pc.getSenders()) {
			if (sender.track?.kind !== "video") continue
			const params = sender.getParameters()
			params.encodings = params.encodings?.length ? params.encodings : [{}]
			for (const e of params.encodings) {
				if (saverRef.current && !mediaRef.current.screen) e.maxBitrate = SAVER.bitrate
				else delete e.maxBitrate
			}
			await sender.setParameters(params).catch(() => undefined)
		}
	}, [])

	const ensure = useCallback(
		(peerId: string): PeerConn | null => {
			if (!selfPeerId || peerId === selfPeerId) return null
			const existing = conns.current.get(peerId)
			if (existing) return existing
			const pc = new RTCPeerConnection({ iceServers: iceServers() })
			const conn: PeerConn = { pc, polite: selfPeerId < peerId, makingOffer: false, ignoreOffer: false }
			conns.current.set(peerId, conn)

			pc.onnegotiationneeded = async () => {
				try {
					conn.makingOffer = true
					await pc.setLocalDescription()
					const d = pc.localDescription
					if (d) sendSignal(peerId, { kind: "description", type: d.type, sdp: d.sdp })
				} catch {
					/* the next change retries negotiation */
				} finally {
					conn.makingOffer = false
				}
			}
			pc.onicecandidate = ({ candidate }) => {
				if (candidate) {
					sendSignal(peerId, { kind: "candidate", candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex })
				}
			}
			pc.ontrack = ({ streams }) => {
				const stream = streams[0]
				if (stream) updateRemote(peerId, { stream })
			}
			const stream = localRef.current
			if (stream) {
				for (const track of stream.getTracks()) pc.addTrack(track, stream)
				void applyBitrate(pc)
			}
			sendSignal(peerId, { kind: "media", ...mediaRef.current })
			return conn
		},
		[selfPeerId, sendSignal, updateRemote, applyBitrate],
	)

	useEffect(() => {
		return onSignal(async (from, data) => {
			const conn = ensure(from)
			if (!conn) return
			const { pc } = conn
			try {
				if (data.kind === "media") {
					updateRemote(from, { camera: data.camera, mic: data.mic, screen: data.screen })
				} else if (data.kind === "description") {
					const collision = data.type === "offer" && (conn.makingOffer || pc.signalingState !== "stable")
					conn.ignoreOffer = !conn.polite && collision
					if (conn.ignoreOffer) return
					await pc.setRemoteDescription({ type: data.type, sdp: data.sdp })
					if (data.type === "offer") {
						await pc.setLocalDescription()
						const d = pc.localDescription
						if (d) sendSignal(from, { kind: "description", type: d.type, sdp: d.sdp })
					}
				} else {
					try {
						await pc.addIceCandidate({ candidate: data.candidate, sdpMid: data.sdpMid, sdpMLineIndex: data.sdpMLineIndex })
					} catch (e) {
						if (!conn.ignoreOffer) throw e
					}
				}
			} catch {
				/* recovered by the next negotiation */
			}
		})
	}, [onSignal, ensure, sendSignal, updateRemote])

	useEffect(() => {
		const present = new Set(peers.map((p) => p.peerId))
		for (const p of peers) ensure(p.peerId)
		for (const [peerId, conn] of conns.current) {
			if (!present.has(peerId)) {
				conn.pc.close()
				conns.current.delete(peerId)
				setRemotes((r) => {
					const rest = { ...r }
					delete rest[peerId]
					return rest
				})
			}
		}
	}, [peers, ensure])

	useEffect(() => {
		const map = conns.current
		return () => {
			for (const { pc } of map.values()) pc.close()
			map.clear()
			for (const t of localRef.current?.getTracks() ?? []) t.stop()
			screenTrackRef.current?.stop()
		}
	}, [])

	const broadcast = useCallback(() => {
		for (const peerId of conns.current.keys()) sendSignal(peerId, { kind: "media", ...mediaRef.current })
	}, [sendSignal])

	const replaceVideo = useCallback(async (track: MediaStreamTrack | null) => {
		for (const { pc } of conns.current.values()) {
			const sender = pc.getSenders().find((s) => s.track?.kind === "video" || (s.track === null && s.dtmf === null))
			if (sender) await sender.replaceTrack(track).catch(() => undefined)
		}
	}, [])

	const join = useCallback(async () => {
		setError(null)
		try {
			const saver = saverRef.current
			const stream = await navigator.mediaDevices.getUserMedia({
				video: saver
					? { width: { ideal: SAVER.width }, height: { ideal: SAVER.height }, frameRate: { max: SAVER.frameRate }, facingMode: "user" }
					: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
				audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
			})
			localRef.current = stream
			cameraTrackRef.current = stream.getVideoTracks()[0] ?? null
			setLocal(stream)
			for (const { pc } of conns.current.values()) {
				for (const track of stream.getTracks()) pc.addTrack(track, stream)
				void applyBitrate(pc)
			}
			setMediaState({ camera: true, mic: true, screen: false })
			broadcast()
			return true
		} catch (e) {
			const name = (e as { name?: string }).name
			setError(
				name === "NotAllowedError"
					? "Camera and microphone access was blocked. Allow it in your browser's site settings."
					: name === "NotFoundError"
						? "No camera or microphone was found."
						: "Couldn't start your camera and microphone.",
			)
			return false
		}
	}, [broadcast, setMediaState, applyBitrate])

	const stopScreen = useCallback(async () => {
		const screen = screenTrackRef.current
		if (!screen) return
		screenTrackRef.current = null
		screen.stop()
		const camera = cameraTrackRef.current
		await replaceVideo(camera)
		const stream = localRef.current
		if (stream) {
			stream.removeTrack(screen)
			if (camera && !stream.getVideoTracks().includes(camera)) stream.addTrack(camera)
			setLocal(new MediaStream(stream.getTracks()))
		}
		setMediaState({ ...mediaRef.current, screen: false })
		broadcast()
	}, [replaceVideo, setMediaState, broadcast])

	const shareScreen = useCallback(async () => {
		if (!localRef.current) return
		setError(null)
		try {
			const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { max: 15 } }, audio: false })
			const track = display.getVideoTracks()[0]
			if (!track) return
			track.contentHint = "detail"
			screenTrackRef.current = track
			track.onended = () => void stopScreen()
			await replaceVideo(track)
			const stream = localRef.current
			const camera = cameraTrackRef.current
			if (camera) stream.removeTrack(camera)
			stream.addTrack(track)
			setLocal(new MediaStream(stream.getTracks()))
			setMediaState({ ...mediaRef.current, screen: true })
			for (const { pc } of conns.current.values()) void applyBitrate(pc)
			broadcast()
		} catch (e) {
			if ((e as { name?: string }).name !== "NotAllowedError") setError("Couldn't share your screen.")
		}
	}, [replaceVideo, setMediaState, broadcast, stopScreen, applyBitrate])

	const leave = useCallback(() => {
		const stream = localRef.current
		if (!stream) return
		screenTrackRef.current?.stop()
		screenTrackRef.current = null
		for (const { pc } of conns.current.values()) {
			for (const sender of pc.getSenders()) if (sender.track) pc.removeTrack(sender)
		}
		for (const t of stream.getTracks()) t.stop()
		cameraTrackRef.current?.stop()
		localRef.current = null
		cameraTrackRef.current = null
		setLocal(null)
		setMediaState(NO_MEDIA)
		broadcast()
	}, [broadcast, setMediaState])

	const toggle = useCallback(
		(kind: "camera" | "mic") => {
			const stream = localRef.current
			if (!stream) return
			const next = !mediaRef.current[kind]
			if (kind === "camera") {
				if (cameraTrackRef.current) cameraTrackRef.current.enabled = next
			} else {
				for (const t of stream.getAudioTracks()) t.enabled = next
			}
			setMediaState({ ...mediaRef.current, [kind]: next })
			broadcast()
		},
		[broadcast, setMediaState],
	)

	const toggleDataSaver = useCallback(async () => {
		saverRef.current = !saverRef.current
		setDataSaver(saverRef.current)
		const camera = cameraTrackRef.current
		if (camera) {
			await camera
				.applyConstraints(
					saverRef.current
						? { width: { ideal: SAVER.width }, height: { ideal: SAVER.height }, frameRate: { max: SAVER.frameRate } }
						: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } },
				)
				.catch(() => undefined)
		}
		for (const { pc } of conns.current.values()) void applyBitrate(pc)
	}, [applyBitrate])

	const remotePeers: RemotePeer[] = peers
		.filter((p) => p.peerId !== selfPeerId)
		.map((p) => ({ peerId: p.peerId, name: p.name, ...(remotes[p.peerId] ?? { ...NO_MEDIA, stream: null }) }))

	return {
		local,
		...media,
		dataSaver,
		error,
		remotePeers,
		inCall: local !== null,
		join,
		leave,
		toggle,
		shareScreen,
		stopScreen,
		toggleDataSaver,
	}
}
