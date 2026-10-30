import Link from "next/link"
import { Logo } from "@/components/logo"

export function Footer() {
	return (
		<footer className="border-t border-border">
			<div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
				<Link href="/" className="flex items-center gap-2 font-semibold text-text">
					<Logo className="size-4" /> Quorum
				</Link>
				<p className="font-mono text-[12px]">Built on Mozaik</p>
			</div>
		</footer>
	)
}
