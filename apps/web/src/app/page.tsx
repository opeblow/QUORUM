import { ArrowRight, Check } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Footer } from "@/components/marketing/footer"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { AGENTS } from "@/lib/agents"

const ROSTER = [
	{ role: "fact_checker", when: "Someone states a fact", does: "Checks it against the web and posts a verdict with sources — and a correction when it’s wrong." },
	{ role: "decision_tracker", when: "The room commits", does: "Records the decision and the reason given, so nobody argues later about what was agreed." },
	{ role: "action_owner", when: "Someone says “I’ll…”", does: "Turns it into an owned, dated action item — only after a person in the room approves it." },
	{ role: "devils_advocate", when: "Everyone agrees too fast", does: "Raises the strongest counter-argument and one question worth answering before moving on." },
	{ role: "scribe", when: "Continuously", does: "Keeps a running summary, so anyone who joins late can catch up in ten seconds." },
] as const

const DIFFERENT = [
	"Video, voice and a live transcript in one browser tab — no app to install, guests join with a name.",
	"Claims are fact-checked while they’re being made, with links to the sources.",
	"Decisions and action items are written down during the meeting, not reconstructed after it.",
	"An agent whose job is to disagree, so a room never mistakes momentum for consensus.",
	"Nothing is done on anyone’s behalf without an explicit yes from a person in the room.",
	"Late joiners get a summary of what they missed, instantly.",
]

export default function Landing() {
	return (
		<>
			<SiteHeader />
			<main className="flex-1">
				{/* Hero */}
				<section className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:px-8 sm:pt-28">
					<p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
						<span className="size-1.5 bg-accent" /> Built on Mozaik
					</p>
					<h1 className="mt-6 max-w-4xl font-display text-[56px] leading-[0.98] tracking-[-0.02em] text-text sm:text-[88px]">
						Meetings that <em className="text-accent">think</em> with you.
					</h1>
					<div className="mt-8 grid gap-8 sm:grid-cols-[1.4fr_1fr] sm:items-end">
						<p className="max-w-xl text-[19px] leading-[1.55] text-muted">
							Quorum is a video meeting room with a team of AI agents inside it. Talk face to face while they fact-check claims, record
							decisions and capture action items — at the same time, in real time.
						</p>
						<div className="flex flex-wrap items-center gap-3 sm:justify-end">
							<Button asChild size="lg">
								<Link href="/sign-up">
									Start a meeting <ArrowRight />
								</Link>
							</Button>
							<Button asChild size="lg" variant="ghost">
								<Link href="#how">How it works</Link>
							</Button>
						</div>
					</div>
				</section>

				<section className="mx-auto max-w-6xl px-5 sm:px-8">
					<figure className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_1px_2px_rgb(20_20_19/0.05),0_24px_48px_-24px_rgb(20_20_19/0.18)]">
						<Image
							src="/product/room.png"
							alt="A live Quorum room: the transcript on the left, five agents in the centre, fact-checks, decisions and approved action items on the right."
							width={2880}
							height={1800}
							priority
						/>
					</figure>
					<figcaption className="mt-3 font-mono text-[12px] text-faint">A real meeting in Quorum. Nothing staged.</figcaption>
				</section>

				{/* 01 — agents */}
				<section id="team" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28 sm:px-8">
					<SectionLabel n="01" label="The team" />
					<div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.6fr]">
						<h2 className="font-display text-[44px] leading-[1.02] tracking-[-0.015em] sm:text-[56px]">
							Five specialists. <em>All listening at once.</em>
						</h2>
						<p className="max-w-xl self-end text-[17px] leading-relaxed text-muted">
							Each agent hears every word and decides for itself when to act. They coordinate through shared state — so no claim is checked
							twice, and one agent can stop another when its premise turns out to be false.
						</p>
					</div>
					<ul className="mt-14 border-t border-text">
						{ROSTER.map((r) => {
							const meta = AGENTS[r.role]
							const Icon = meta.icon
							return (
								<li key={r.role} className="grid gap-3 border-b border-border py-6 sm:grid-cols-[240px_220px_1fr] sm:gap-8">
									<p className="flex items-center gap-3 text-[17px] font-medium">
										<Icon className="size-5" style={{ color: meta.color }} /> {meta.label}
									</p>
									<p className="font-mono text-[13px] leading-6 text-faint">{r.when}</p>
									<p className="text-[16px] leading-relaxed text-muted">{r.does}</p>
								</li>
							)
						})}
					</ul>
				</section>

				{/* 02 — different */}
				<section className="border-y border-border bg-surface">
					<div className="mx-auto grid max-w-6xl gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[1fr_1.3fr]">
						<div>
							<SectionLabel n="02" label="Why switch" />
							<h2 className="mt-6 font-display text-[44px] leading-[1.02] tracking-[-0.015em] sm:text-[56px]">
								Your call app shows faces. <em>Quorum does the work.</em>
							</h2>
						</div>
						<ul className="divide-y divide-border self-end">
							{DIFFERENT.map((d) => (
								<li key={d} className="flex gap-4 py-4 text-[16px] leading-relaxed">
									<Check className="mt-1 size-4 shrink-0 text-accent" strokeWidth={2.5} />
									<span>{d}</span>
								</li>
							))}
						</ul>
					</div>
				</section>

				{/* 03 — how */}
				<section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28 sm:px-8">
					<SectionLabel n="03" label="How it works" />
					<ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
						{[
							["Open a room", "One click. Share the link — guests join with just their name."],
							["Turn on your camera", "Video and voice run in the browser. Everyone sees the live transcript."],
							["Let the agents work", "Verdicts, decisions, actions and challenges appear while you talk."],
							["Leave with the record", "End the meeting and everyone lands on the same recap."],
						].map(([t, b], i) => (
							<li key={t} className="bg-surface p-7">
								<p className="font-mono text-[12px] text-faint">0{i + 1}</p>
								<h3 className="mt-8 text-[18px] font-medium">{t}</h3>
								<p className="mt-2 text-[15px] leading-relaxed text-muted">{b}</p>
							</li>
						))}
					</ol>
				</section>

				{/* CTA */}
				<section className="mx-auto max-w-6xl px-5 pb-28 sm:px-8">
					<div className="rounded-2xl bg-text px-8 py-16 text-white sm:px-14 sm:py-20">
						<h2 className="max-w-2xl font-display text-[44px] leading-[1.02] tracking-[-0.015em] sm:text-[60px]">
							Your next meeting, <em className="text-[#ff8a4c]">with backup.</em>
						</h2>
						<div className="mt-10 flex flex-wrap items-center gap-4">
							<Button asChild size="lg" variant="accent">
								<Link href="/sign-up">
									Create a free room <ArrowRight />
								</Link>
							</Button>
							<span className="text-[14px] text-white/60">No download. Works in Chrome and Edge.</span>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	)
}

function SectionLabel({ n, label }: { n: string; label: string }) {
	return (
		<p className="flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
			<span className="text-accent">{n}</span>
			<span className="h-px w-8 bg-border-strong" />
			{label}
		</p>
	)
}
