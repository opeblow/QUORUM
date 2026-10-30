"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

/** Only same-site relative paths are allowed as post-auth destinations (no open redirects). */
function safeNext(value: string | null): string {
	return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
	const router = useRouter()
	const next = safeNext(useSearchParams().get("next"))
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		setPending(true)
		const form = new FormData(event.currentTarget)
		const email = String(form.get("email") ?? "").trim()
		const password = String(form.get("password") ?? "")
		const name = String(form.get("name") ?? "").trim()
		const result =
			mode === "sign-up"
				? await authClient.signUp.email({ email, password, name })
				: await authClient.signIn.email({ email, password })
		setPending(false)
		if (result.error) {
			setError(result.error.message ?? "Something went wrong. Please try again.")
			return
		}
		router.push(next)
		router.refresh()
	}

	return (
		<form onSubmit={onSubmit} className="space-y-5">
			{mode === "sign-up" && (
				<div className="space-y-1.5">
					<Label htmlFor="name">Your name</Label>
					<Input id="name" name="name" required maxLength={60} autoComplete="name" placeholder="Ana Petrović" />
				</div>
			)}
			<div className="space-y-1.5">
				<Label htmlFor="email">Email</Label>
				<Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					required
					minLength={10}
					autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
				/>
				{mode === "sign-up" && <p className="text-[11px] text-faint">At least 10 characters.</p>}
			</div>
			{error && (
				<p role="alert" className="rounded-xl border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
					{error}
				</p>
			)}
			<Button type="submit" size="lg" className="w-full" disabled={pending}>
				{pending ? "One moment…" : mode === "sign-up" ? "Create account" : "Sign in"}
			</Button>
			<p className="text-center text-sm text-muted">
				{mode === "sign-up" ? "Already have an account? " : "New to Quorum? "}
				<Link
					className="text-accent hover:underline"
					href={`${mode === "sign-up" ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`}
				>
					{mode === "sign-up" ? "Sign in" : "Create an account"}
				</Link>
			</p>
		</form>
	)
}
