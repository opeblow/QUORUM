import { LoopAbortedError } from "./loop-tracker"

let installed = false
let warningsDeduped = false

/**
 * The Mozaik Cloud SDK warns once per agent loop when no key is configured. Synchronous console
 * writes on a hot path cost real latency under load, so identical warnings print only once.
 */
export function dedupeConsoleWarnings(): void {
	if (warningsDeduped) return
	warningsDeduped = true
	const seen = new Set<string>()
	const warn = console.warn.bind(console)
	console.warn = (...args: unknown[]) => {
		const key = args.map(String).join(" ")
		if (seen.has(key)) return
		if (seen.size < 1000) seen.add(key)
		warn(...args)
	}
}

/**
 * `runLoop` does not await or catch its loop, so a failed loop surfaces as an unhandled
 * rejection — which terminates Node by default. A room server must never die because one
 * room's model call failed. Deliberate aborts are already reported through the LoopTracker;
 * anything else is logged loudly but does not take every other room down with it.
 */
export function installProcessGuards(log: (message: string, error: unknown) => void = defaultLog): void {
	if (installed) return
	installed = true
	process.on("unhandledRejection", (reason) => {
		if (reason instanceof LoopAbortedError) return
		log("Unhandled rejection", reason)
	})
}

function defaultLog(message: string, error: unknown): void {
	console.error(`[quorum] ${message}:`, error)
}
