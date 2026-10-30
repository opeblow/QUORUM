import { z } from "zod"
import { defineTool, type ToolDefinition } from "../agents/definition"

export interface WebSearchConfig {
	readonly apiKey: string
	readonly timeoutMs?: number
	readonly maxResults?: number
	readonly fetchImpl?: typeof fetch
}

const TavilyResponse = z.object({
	answer: z.string().nullish(),
	results: z
		.array(
			z.object({
				title: z.string().default(""),
				url: z.string(),
				content: z.string().default(""),
			}),
		)
		.default([]),
})

const MAX_SNIPPET = 500

/** Web search backed by Tavily. Results are returned as compact text the model can cite. */
export function createWebSearchTool(config: WebSearchConfig): ToolDefinition<never> {
	const fetchImpl = config.fetchImpl ?? fetch
	const timeoutMs = config.timeoutMs ?? 12_000
	const maxResults = config.maxResults ?? 5

	return defineTool({
		name: "web_search",
		description:
			"Search the web for current, citable information. Use precise queries (entities, numbers, dates). Returns titles, URLs and snippets.",
		args: z.strictObject({ query: z.string().min(3).max(300) }),
		async invoke({ query }) {
			const response = await fetchImpl("https://api.tavily.com/search", {
				method: "POST",
				headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
				body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_answer: true }),
				signal: AbortSignal.timeout(timeoutMs),
			})
			if (!response.ok) {
				// Status only: response bodies can echo request details we don't want in model context.
				throw new Error(`web_search failed with HTTP ${response.status}`)
			}
			const data = TavilyResponse.parse(await response.json())
			if (data.results.length === 0) return "No results."
			const lines = data.results.map(
				(r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, MAX_SNIPPET).replace(/\s+/gu, " ")}`,
			)
			return [data.answer ? `Summary: ${data.answer}` : null, ...lines].filter(Boolean).join("\n")
		},
	})
}
