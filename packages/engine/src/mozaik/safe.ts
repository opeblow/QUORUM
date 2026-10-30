import { SituationSpecification, type SituationContext, type SituationHandler } from "@mozaik-ai/core"

export type ErrorReporter = (where: string, error: unknown) => void

/**
 * The runtime fans events out synchronously and does not catch handler errors, so one throwing
 * handler would break delivery for everyone after it — and an async one would surface as an
 * unhandled rejection. Every handler we register goes through here.
 */
export function safeHandler(name: string, handler: SituationHandler, report: ErrorReporter): SituationHandler {
	return {
		specification: new GuardedSpecification(name, handler.specification, report),
		processor: {
			apply(context) {
				try {
					const result = handler.processor.apply(context)
					if (result instanceof Promise) result.catch((error: unknown) => report(`${name}.apply`, error))
				} catch (error) {
					report(`${name}.apply`, error)
				}
			},
		},
	}
}

class GuardedSpecification extends SituationSpecification {
	constructor(
		private readonly name: string,
		private readonly inner: SituationSpecification,
		private readonly report: ErrorReporter,
	) {
		super()
	}

	isSatisfiedBy(context: SituationContext): boolean {
		try {
			return this.inner.isSatisfiedBy(context)
		} catch (error) {
			this.report(`${this.name}.isSatisfiedBy`, error)
			return false
		}
	}
}

const MAX_REASON = 160

/**
 * Short, safe reason text. Provider errors can echo (partially masked) credentials and request
 * details; these reasons travel on the bus to UIs and audit logs, so we redact and clip them.
 */
export function describeError(error: unknown): string {
	const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"
	const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined
	if (status === 401 || status === 403 || /incorrect api key|invalid api key|authentication/iu.test(raw)) {
		return `authentication failed (HTTP ${typeof status === "number" ? status : 401}) — check the provider API key`
	}
	const redacted = raw
		.replace(/\b(sk|pk|tvly|key|m0)[-_][A-Za-z0-9_\-*]{6,}/gu, "[redacted]")
		.replace(/(api[_ -]?key[^:]*:)\s*\S+/giu, "$1 [redacted]")
		.replace(/\s+/gu, " ")
		.trim()
	return redacted.length <= MAX_REASON ? redacted : `${redacted.slice(0, MAX_REASON - 1)}…`
}
