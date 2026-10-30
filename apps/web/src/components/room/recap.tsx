import type { ClaimView, RoomView } from "@quorum/protocol"
import { CheckCircle2, Gavel, ListChecks, Scale, SearchCheck } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { recapMarkdown } from "@/lib/recap-markdown"
import { CopyMarkdownButton } from "./copy-markdown-button"

const VERDICT: Partial<Record<ClaimView["status"], { text: string; color: string }>> = {
	supported: { text: "Supported", color: "var(--ok)" },
	disputed: { text: "Disputed", color: "var(--warn)" },
	refuted: { text: "False", color: "var(--bad)" },
	unverifiable: { text: "Can't verify", color: "var(--muted)" },
	failed: { text: "Not checked", color: "var(--faint)" },
}

export function Recap({ title, endedAt, view }: { title: string; endedAt: Date | null; view: RoomView | null }) {
	const approved = view?.actions.filter((a) => a.status === "approved") ?? []
	const claims = view?.claims.filter((c) => VERDICT[c.status]) ?? []
	return (
		<div className="relative min-h-dvh overflow-x-clip">
			<header className="relative z-10 border-b border-border bg-white/70 backdrop-blur-xl">
				<div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
					<Link href="/" className="flex items-center gap-2 font-semibold">
						<Logo className="size-6" /> Quorum
					</Link>
					<div className="flex gap-2">
						{view && <CopyMarkdownButton markdown={recapMarkdown(title, view)} />}
						<Button asChild size="sm" variant="ghost">
							<Link href="/dashboard">Dashboard</Link>
						</Button>
					</div>
				</div>
			</header>
			<main className="relative mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
				<p className="font-mono text-[12px] uppercase tracking-[0.14em] text-accent">Meeting recap</p>
				<h1 className="font-display mt-2 text-[44px] leading-none tracking-[-0.015em] sm:text-[56px] text-balance">{title}</h1>
				{endedAt && (
					<p className="mt-1 text-sm text-muted">Ended {endedAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}</p>
				)}

				{!view ? (
					<p className="mt-10 rounded-xl border border-dashed border-border p-8 text-center text-sm text-faint">
						Nothing was recorded in this meeting.
					</p>
				) : (
					<div className="mt-12 space-y-5">
						{view.summary.text && (
							<Section icon={<CheckCircle2 className="size-4 text-accent" />} title="Summary">
								<p className="leading-relaxed text-muted">{view.summary.text}</p>
								{view.summary.topics.length > 0 && (
									<p className="mt-3 flex flex-wrap gap-1.5">
										{view.summary.topics.map((t) => (
											<span key={t} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
												{t}
											</span>
										))}
									</p>
								)}
							</Section>
						)}

						<Section icon={<Gavel className="size-4" style={{ color: "var(--agent-decision_tracker)" }} />} title="Decisions" empty={!view.decisions.length}>
							<ul className="space-y-3">
								{view.decisions.map((d) => (
									<li key={d.id}>
										<p className="font-medium">{d.text}</p>
										{d.rationale && <p className="text-sm text-muted">{d.rationale}</p>}
									</li>
								))}
							</ul>
						</Section>

						<Section icon={<ListChecks className="size-4" style={{ color: "var(--agent-action_owner)" }} />} title="Action items" empty={!approved.length}>
							<ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-black/[0.02]">
								{approved.map((a) => (
									<li key={a.id} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
										<span>
											<span className="font-medium">{a.assignee}</span> — {a.task}
										</span>
										{a.due && <span className="shrink-0 text-xs text-muted">due {a.due}</span>}
									</li>
								))}
							</ul>
						</Section>

						<Section icon={<SearchCheck className="size-4" style={{ color: "var(--agent-fact_checker)" }} />} title="Fact-checks" empty={!claims.length}>
							<ul className="space-y-4">
								{claims.map((c) => {
									const v = VERDICT[c.status]
									return (
										<li key={c.id} className="border-l-2 pl-3" style={{ borderColor: v?.color }}>
											<p className="text-xs font-medium" style={{ color: v?.color }}>
												{v?.text}
											</p>
											<p className="text-sm">
												“{c.text}” <span className="text-faint">— {c.speakerName}</span>
											</p>
											{c.verdict && <p className="mt-1 text-sm text-muted">{c.verdict}</p>}
											{c.correction && <p className="mt-1 text-sm">Correction: {c.correction}</p>}
											{c.sources.length > 0 && (
												<p className="mt-1 flex flex-wrap gap-2 text-xs">
													{c.sources.map((s) => (
														<a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
															{hostOf(s.url)}
														</a>
													))}
												</p>
											)}
										</li>
									)
								})}
							</ul>
						</Section>

						{view.recalls.length > 0 && (
							<Section icon={<span className="size-2 rounded-full bg-[var(--agent-memory_keeper)]" />} title="From earlier meetings">
								<ul className="space-y-3">
									{view.recalls.map((r) => (
										<li key={r.id} className="text-sm">
											<p className="text-text">{r.memory}</p>
											<p className="mt-1 text-muted">
												<span className={r.relation === "contradicts" ? "font-medium text-bad" : ""}>{r.relation === "contradicts" ? "Contradicted. " : ""}</span>
												{r.note}
											</p>
										</li>
									))}
								</ul>
							</Section>
						)}
						{view.challenges.length > 0 && (
							<Section icon={<Scale className="size-4" style={{ color: "var(--agent-devils_advocate)" }} />} title="Challenges raised">
								<ul className="space-y-3">
									{view.challenges.map((c) => (
										<li key={c.id} className="text-sm">
											<p className="text-muted">{c.argument}</p>
											<p className="mt-1 font-medium">{c.question}</p>
										</li>
									))}
								</ul>
							</Section>
						)}

						{view.utterances.length > 0 && (
							<details className="glass rounded-3xl p-6">
								<summary className="cursor-pointer text-sm font-medium">Full transcript ({view.utterances.length} lines)</summary>
								<div className="mt-4 space-y-2">
									{view.utterances.map((u) => (
										<p key={u.seq} className="text-sm">
											<span className="font-medium">{u.speakerName}: </span>
											<span className="text-muted">{u.text}</span>
										</p>
									))}
								</div>
							</details>
						)}
					</div>
				)}
			</main>
		</div>
	)
}

function Section({ icon, title, empty, children }: { icon: ReactNode; title: string; empty?: boolean; children: ReactNode }) {
	return (
		<section className="glass rounded-3xl p-6 sm:p-7">
			<h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
				{icon} {title}
			</h2>
			{empty ? <p className="text-sm text-faint">None.</p> : children}
		</section>
	)
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./u, "")
	} catch {
		return url
	}
}
