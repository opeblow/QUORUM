"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

/** Minimal typing for the Web Speech API (not in TypeScript's DOM lib). */
interface RecognitionResult {
	readonly isFinal: boolean
	readonly 0: { readonly transcript: string }
}
interface RecognitionEvent {
	readonly resultIndex: number
	readonly results: ArrayLike<RecognitionResult>
}
interface Recognition {
	continuous: boolean
	interimResults: boolean
	lang: string
	onresult: ((e: RecognitionEvent) => void) | null
	onerror: ((e: { error: string }) => void) | null
	onend: (() => void) | null
	start(): void
	stop(): void
	abort(): void
}
type RecognitionCtor = new () => Recognition

const noopSubscribe = () => () => {}

function recognitionCtor(): RecognitionCtor | null {
	if (typeof window === "undefined") return null
	const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type SpeechStatus = "unsupported" | "idle" | "listening" | "denied" | "error"

const ERROR_TEXT: Record<string, string> = {
	"not-allowed": "Microphone access was blocked. Allow it in the browser's site settings.",
	"service-not-allowed": "Speech recognition isn't allowed in this browser.",
	"audio-capture": "No microphone was found.",
	network: "Speech recognition lost its connection. It will retry.",
}

/**
 * Browser speech-to-text. Chrome ends recognition after silence, so while the user wants the mic
 * on we restart it; finalized phrases go to `onFinal`, the in-progress phrase is exposed as `interim`.
 */
export function useSpeech(onFinal: (text: string) => void, lang?: string) {
	const [status, setStatus] = useState<SpeechStatus>("idle")
	const [interim, setInterim] = useState("")
	const [error, setError] = useState<string | null>(null)
	const recognitionRef = useRef<Recognition | null>(null)
	const wantOnRef = useRef(false)
	const onFinalRef = useRef(onFinal)
	useEffect(() => {
		onFinalRef.current = onFinal
	}, [onFinal])
	// Browser capability: read on the client, assumed present during server render.
	const supported = useSyncExternalStore(noopSubscribe, () => recognitionCtor() !== null, () => true)

	useEffect(() => {
		return () => {
			wantOnRef.current = false
			recognitionRef.current?.abort()
		}
	}, [])

	const start = useCallback(() => {
		const Ctor = recognitionCtor()
		if (!Ctor) return setStatus("unsupported")
		recognitionRef.current?.abort()
		const r = new Ctor()
		r.continuous = true
		r.interimResults = true
		r.lang = lang ?? navigator.language ?? "en-US"
		r.onresult = (e) => {
			let pending = ""
			for (let i = e.resultIndex; i < e.results.length; i++) {
				const result = e.results[i]
				if (!result) continue
				const text = result[0].transcript.trim()
				if (result.isFinal) {
					if (text) onFinalRef.current(text)
				} else {
					pending += `${text} `
				}
			}
			setInterim(pending.trim())
		}
		r.onerror = (e) => {
			if (e.error === "no-speech" || e.error === "aborted") return
			setError(ERROR_TEXT[e.error] ?? `Speech recognition error: ${e.error}`)
			if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
				wantOnRef.current = false
				setStatus("denied")
			}
		}
		r.onend = () => {
			setInterim("")
			if (wantOnRef.current) {
				// Restart after silence or a transient error; small delay avoids a tight loop.
				setTimeout(() => {
					if (wantOnRef.current) {
						try {
							r.start()
						} catch {
							/* already started */
						}
					}
				}, 250)
			} else {
				setStatus((s) => (s === "denied" ? s : "idle"))
			}
		}
		recognitionRef.current = r
		wantOnRef.current = true
		setError(null)
		try {
			r.start()
			setStatus("listening")
		} catch {
			setStatus("error")
		}
	}, [lang])

	const stop = useCallback(() => {
		wantOnRef.current = false
		recognitionRef.current?.stop()
		setStatus("idle")
	}, [])

	return { status: supported ? status : ("unsupported" as const), interim, error, start, stop }
}
