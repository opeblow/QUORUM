"use client"

import { Plus } from "lucide-react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createRoomAction, type CreateRoomState } from "./actions"

const initial: CreateRoomState = { error: null }

export function CreateRoomForm() {
	const [state, action, pending] = useActionState(createRoomAction, initial)
	return (
		<form action={action} className="flex flex-col gap-2 sm:flex-row">
			<Input name="title" required maxLength={80} placeholder="Weekly product sync" aria-label="Meeting name" className="flex-1" />
			<Button type="submit" variant="brand" disabled={pending}>
				<Plus /> {pending ? "Creating…" : "New room"}
			</Button>
			{state.error && (
				<p role="alert" className="text-sm text-bad sm:self-center">
					{state.error}
				</p>
			)}
		</form>
	)
}
