import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = { title: "Create account" }

export default function SignUpPage() {
	return (
		<AuthShell title="Create your account" subtitle="Hosts need an account. Guests join from a link.">
			<Suspense>
				<AuthForm mode="sign-up" />
			</Suspense>
		</AuthShell>
	)
}
