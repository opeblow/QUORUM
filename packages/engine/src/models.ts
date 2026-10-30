import type { ModelTier } from "./agents/definition"

/** Ordered model chains per tier: first is preferred, the rest are cross-provider fallbacks. */
export type ModelPlan = Record<ModelTier, readonly string[]>

interface ProviderModels {
	readonly envKey: string
	readonly fast: string
	readonly smart: string
}

const PROVIDERS: readonly ProviderModels[] = [
	{ envKey: "ANTHROPIC_API_KEY", fast: "claude-haiku-4-5", smart: "claude-sonnet-5-5" },
	{ envKey: "OPENAI_API_KEY", fast: "gpt-5.4-mini", smart: "gpt-5.5" },
	{ envKey: "GEMINI_API_KEY", fast: "gemini-3.5-flash-lite", smart: "gemini-3.5-flash" },
]

/**
 * Builds the plan from whichever provider keys are configured.
 * QUORUM_MODELS_FAST / QUORUM_MODELS_SMART (comma-separated) override the defaults.
 */
export function planModels(env: Record<string, string | undefined>): ModelPlan {
	const available = PROVIDERS.filter((p) => Boolean(env[p.envKey]?.trim()))
	const fast = parseList(env.QUORUM_MODELS_FAST) ?? available.map((p) => p.fast)
	const smart = parseList(env.QUORUM_MODELS_SMART) ?? available.map((p) => p.smart)
	if (fast.length === 0 || smart.length === 0) {
		throw new Error(
			`No model provider configured. Set at least one of ${PROVIDERS.map((p) => p.envKey).join(", ")}.`,
		)
	}
	return { fast, smart }
}

/** Fallback chain to try after `model` fails: the rest of its own tier, then the other tier. */
export function fallbacksFor(plan: ModelPlan, model: string): string[] {
	const ownTier = plan.fast.includes(model) ? plan.fast : plan.smart.includes(model) ? plan.smart : []
	const otherTier = ownTier === plan.fast ? plan.smart : plan.fast
	return unique([...ownTier, ...otherTier]).filter((m) => m !== model)
}

function parseList(value: string | undefined): string[] | null {
	const list = value
		?.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
	return list && list.length > 0 ? list : null
}

function unique(items: readonly string[]): string[] {
	return [...new Set(items)]
}
