import { ArrowUpRight, FileText, Radio } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { SpotlightCard } from "@/components/fx/spotlight-card"
import { Logo } from "@/components/logo"
import { listRoomsFor } from "@/lib/rooms"
import { requireMember } from "@/lib/session"
import { CreateRoomForm } from "./create-room-form"
import { SignOutButton } from "./sign-out-button"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
	return (
		<div className="relative min-h-dvh overflow-x-clip">
			<header className="relative z-10 border-b border-border bg-white/70 backdrop-blur-xl">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
					<Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
						<Logo className="size-6" /> Quorum
					</Link>
					<SignOutButton />
				</div>
			</header>
			<main className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
				<Suspense fallback={<DashboardSkeleton />}>
					<Dashboard />
				</Suspense>
			</main>
		</div>
	)
}

async function Dashboard() {
	const user = await requireMember()
	const rooms = await listRoomsFor(user.id)
	const open = rooms.filter((r) => r.status === "open").length
	return (
		<div className="space-y-12">
			<section className="grid items-end gap-8 lg:grid-cols-[1fr_1.1fr]">
				<div>
					<p className="font-mono text-[12px] uppercase tracking-[0.14em] text-accent">Dashboard</p>
					<h1 className="font-display mt-2 text-[44px] leading-none tracking-[-0.015em] sm:text-[56px]">Hi {user.name.split(" ")[0]}.</h1>
					<p className="mt-3 text-[15px] text-muted">
						{rooms.length === 0
							? "Start your first room — your agent team is ready."
							: `${rooms.length} room${rooms.length === 1 ? "" : "s"} · ${open} open`}
					</p>
				</div>
				<div className="glass relative overflow-hidden rounded-3xl p-6">
					<p className="text-[15px] font-semibold">Start a room</p>
					<p className="mb-4 mt-1 text-[13px] text-muted">Name the meeting, then share its link with everyone joining.</p>
					<CreateRoomForm />
				</div>
			</section>

			<section>
				<h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">Your rooms</h2>
				{rooms.length === 0 ? (
					<div className="glass rounded-3xl p-12 text-center">
						<Radio className="mx-auto size-6 text-faint" />
						<p className="mt-3 text-sm text-muted">No rooms yet. Your first one is a click away.</p>
					</div>
				) : (
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{rooms.map((room) => {
							const isOpen = room.status === "open"
							return (
								<li key={room.id}>
									<Link href={`/r/${room.id}`} className="block h-full">
										<SpotlightCard className="h-full p-5">
											<div className="flex items-start justify-between gap-3">
												<span
													className={`grid size-10 place-items-center rounded-xl border ${isOpen ? "border-ok/30 bg-ok/10" : "border-border bg-black/[0.025]"}`}
												>
													{isOpen ? <Radio className="size-4 text-ok" /> : <FileText className="size-4 text-muted" />}
												</span>
												<ArrowUpRight className="size-4 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text" />
											</div>
											<p className="mt-5 truncate text-[15px] font-semibold tracking-tight">{room.title}</p>
											<p className="mt-1 flex items-center gap-2 text-[12px] text-faint">
												<span className={`size-1.5 rounded-full ${isOpen ? "bg-ok" : "bg-faint"}`} />
												{isOpen ? "Open" : "Recap ready"} ·{" "}
												{room.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
											</p>
										</SpotlightCard>
									</Link>
								</li>
							)
						})}
					</ul>
				)}
			</section>
		</div>
	)
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6" aria-busy="true">
			<div className="h-12 w-64 animate-pulse rounded-xl bg-black/[0.04]" />
			<div className="h-36 w-full animate-pulse rounded-3xl bg-black/[0.04]" />
			<div className="grid gap-4 sm:grid-cols-3">
				{[0, 1, 2].map((i) => (
					<div key={i} className="h-36 animate-pulse rounded-2xl bg-black/[0.04]" />
				))}
			</div>
		</div>
	)
}
