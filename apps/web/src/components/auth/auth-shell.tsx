import Link from "next/link"
import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { AGENTS } from "@/lib/agents"

const ROLES = ["fact_checker", "decision_tracker", "action_owner", "devils_advocate", "scribe"] as const

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
	return (
		<main className="grid min-h-dvh flex-1 lg:grid-cols-[1fr_1fr]">
			<section className="flex flex-col px-6 py-8 sm:px-12">
				<Link href="/" className="flex w-fit items-center gap-2.5 font-semibold tracking-tight">
					<Logo className="size-5" /> Quorum
				</Link>
				<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
					<h1 className="font-display text-[44px] leading-none tracking-[-0.015em]">{title}</h1>
					<p className="mb-9 mt-3 text-[15px] text-muted">{subtitle}</p>
					{children}
				</div>
			</section>
			<aside className="hidden flex-col justify-between bg-text p-12 text-white lg:flex">
				<p className="font-mono text-[12px] uppercase tracking-[0.14em] text-white/50">Built on Mozaik</p>
				<div>
					<p className="font-display text-[52px] leading-[1.02] tracking-[-0.015em]">
						Five agents. One meeting. <em className="text-[#ff8a4c]">All at once.</em>
					</p>
					<ul className="mt-10 space-y-3 border-t border-white/15 pt-6">
						{ROLES.map((r) => (
							<li key={r} className="flex items-baseline justify-between gap-6 text-[14px]">
								<span className="text-white">{AGENTS[r].label}</span>
								<span className="text-right text-white/55">{AGENTS[r].blurb}</span>
							</li>
						))}
					</ul>
				</div>
			</aside>
		</main>
	)
}
