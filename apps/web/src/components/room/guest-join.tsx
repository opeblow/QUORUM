"use client"

import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

/** Guests join with only a name: an anonymous account is created, then named. */
export function GuestJoin({ title }: { title: string }) {
	const router = useRouter()
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const name = String(new FormData(event.currentTarget).get("name") ?? "").trim()
		if (!name) return setError("Tell the room your name")
		setPending(true)
		setError(null)
		const signIn = await authClient.signIn.anonymous()
		if (signIn.error) {
			setPending(false)
			return setError(signIn.error.message ?? "Could not join. Please try again.")
		}
		const update = await authClient.updateUser({ name })
		setPending(false)
		if (update.error) return setError(update.error.message ?? "Could not set your name.")
		router.refresh()
	}

	return (
		<main className="relative grid min-h-dvh flex-1 place-items-center overflow-hidden px-4 py-16">
			<div aria-hidden className="bg-grid absolute inset-0 [mask-image:radial-gradient(circle,black,transparent_65%)]" />
			<form onSubmit={onSubmit} className="glass relative w-full max-w-md overflow-hidden rounded-3xl p-8">
				<Logo className="size-9" />
				<p className="mt-7 text-[13px] font-medium text-faint">You’re invited to join</p>
				<h1 className="font-display mt-1 text-[44px] leading-none tracking-[-0.015em] sm:text-[56px] text-balance">{title}</h1>
				<div className="mt-8 space-y-2">
					<Label htmlFor="name">Your name</Label>
					<Input id="name" name="name" required maxLength={60} autoComplete="name" autoFocus placeholder="How the room will see you" />
				</div>
				{error && (
					<p role="alert" className="mt-3 text-sm text-bad">
						{error}
					</p>
				)}
				<Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
					{pending ? "Joining…" : "Join meeting"} {!pending && <ArrowRight />}
				</Button>
				<p className="mt-4 text-center text-[12px] leading-relaxed text-faint">
					What you say is transcribed and shared with everyone in the room. No account needed.
				</p>
			</form>
		</main>
	)
}
