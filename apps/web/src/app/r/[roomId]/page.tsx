import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { GuestJoin } from "@/components/room/guest-join"
import { LiveRoom } from "@/components/room/live-room"
import { Recap } from "@/components/room/recap"
import { getRoomSnapshot } from "@/lib/recap"
import { findRoom } from "@/lib/rooms"
import { getSessionUser } from "@/lib/session"

export const metadata: Metadata = { title: "Meeting room", robots: { index: false } }

export default function RoomPage({ params }: PageProps<"/r/[roomId]">) {
	return (
		<Suspense fallback={<RoomSkeleton />}>
			<RoomEntry params={params} />
		</Suspense>
	)
}

async function RoomEntry({ params }: { params: PageProps<"/r/[roomId]">["params"] }) {
	const { roomId } = await params
	const room = await findRoom(roomId)
	if (!room) notFound()
	if (room.status !== "open") {
		return <Recap title={room.title} endedAt={room.endedAt} view={await getRoomSnapshot(room.id)} />
	}
	const user = await getSessionUser()
	if (!user) return <GuestJoin title={room.title} />
	return <LiveRoom roomId={room.id} title={room.title} />
}

function RoomSkeleton() {
	return (
		<div className="flex h-dvh flex-col" aria-busy="true">
			<div className="h-14 border-b border-border" />
			<div className="grid flex-1 place-items-center">
				<div className="size-64 animate-pulse rounded-full bg-surface-2" />
			</div>
		</div>
	)
}
