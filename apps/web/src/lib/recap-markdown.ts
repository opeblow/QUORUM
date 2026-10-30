import type { RoomView } from "@quorum/protocol"

const VERDICT: Record<string, string> = {
	supported: "Supported",
	disputed: "Disputed",
	refuted: "False",
	unverifiable: "Can't verify",
}

/** Plain Markdown recap — pastes cleanly into Slack, Notion, Linear or email. */
export function recapMarkdown(title: string, view: RoomView): string {
	const lines: string[] = [`# ${title}`, ""]
	if (view.summary.text) lines.push("## Summary", view.summary.text, "")
	if (view.decisions.length) {
		lines.push("## Decisions", ...view.decisions.map((d) => `- ${d.text}${d.rationale ? ` — ${d.rationale}` : ""}`), "")
	}
	const actions = view.actions.filter((a) => a.status === "approved")
	if (actions.length) {
		lines.push("## Action items", ...actions.map((a) => `- [ ] **${a.assignee}**: ${a.task}${a.due ? ` (due ${a.due})` : ""}`), "")
	}
	const claims = view.claims.filter((c) => VERDICT[c.status])
	if (claims.length) {
		lines.push("## Fact-checks")
		for (const c of claims) {
			lines.push(`- ${VERDICT[c.status]}: "${c.text}" — ${c.verdict ?? ""}${c.correction ? ` Correction: ${c.correction}` : ""}`)
			for (const s of c.sources) lines.push(`  - ${s.url}`)
		}
		lines.push("")
	}
	if (view.challenges.length) {
		lines.push("## Challenges raised", ...view.challenges.map((c) => `- **${c.topic}**: ${c.argument} _${c.question}_`), "")
	}
	return `${lines.join("\n").trim()}\n`
}
