"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createRoomRecord } from "@/lib/rooms"
import { requireMember } from "@/lib/session"

const NewRoom = z.object({ title: z.string().trim().min(1, "Give the meeting a name").max(80) })

export type CreateRoomState = { error: string | null }

export async function createRoomAction(_prev: CreateRoomState, form: FormData): Promise<CreateRoomState> {
	const user = await requireMember()
	const parsed = NewRoom.safeParse({ title: form.get("title") })
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" }
	const room = await createRoomRecord(user.id, parsed.data.title)
	redirect(`/r/${room.id}`)
}
