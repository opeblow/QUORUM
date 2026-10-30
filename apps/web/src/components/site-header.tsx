import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { getSessionUser } from "@/lib/session"
import { Logo } from "./logo"

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur-sm">
			<nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
				<Link href="/" className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight">
					<Logo className="size-5" />
					Quorum
				</Link>
				<div className="hidden items-center gap-8 text-[14px] text-muted md:flex">
					<a href="#team" className="hover:text-text">Agents</a>
					<a href="#how" className="hover:text-text">How it works</a>
				</div>
				<div className="flex items-center gap-2">
					<Suspense fallback={<div className="h-8 w-32" />}>
						<SessionActions />
					</Suspense>
				</div>
			</nav>
		</header>
	)
}

async function SessionActions() {
	const user = await getSessionUser()
	if (user && !user.isAnonymous) {
		return (
			<Button asChild size="sm">
				<Link href="/dashboard">Dashboard</Link>
			</Button>
		)
	}
	return (
		<>
			<Button asChild size="sm" variant="ghost">
				<Link href="/sign-in">Sign in</Link>
			</Button>
			<Button asChild size="sm">
				<Link href="/sign-up">Get started</Link>
			</Button>
		</>
	)
}
