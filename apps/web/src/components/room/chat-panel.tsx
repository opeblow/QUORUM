"use client"

import type { AttachmentView, ChatView } from "@quorum/protocol"
import { ArrowUp, FileText, Loader2, Paperclip } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Avatar } from "./avatar"

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ChatPanel({
	roomId,
	messages,
	youId,
	onSend,
	disabled,
}: {
	roomId: string
	messages: ChatView[]
	youId: string | null
	onSend: (text: string, attachment: AttachmentView | null) => boolean
	disabled: boolean
}) {
	const [draft, setDraft] = useState("")
	const { t } = useI18n()
	const [uploading, setUploading] = useState(false)
	const listRef = useRef<HTMLDivElement>(null)
	const fileRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
	}, [messages.length])

	function submit(e: FormEvent) {
		e.preventDefault()
		const text = draft.trim()
		if (text && onSend(text, null)) setDraft("")
	}

	async function upload(file: File) {
		if (file.size > 10 * 1024 * 1024) return toast.error(t("chat.tooBig"))
		setUploading(true)
		try {
			const body = new FormData()
			body.set("file", file)
			const res = await fetch(`/api/rooms/${roomId}/files`, { method: "POST", body })
			const json = (await res.json()) as AttachmentView & { error?: string }
			if (!res.ok) throw new Error(json.error ?? "Upload failed")
			onSend(draft.trim(), { id: json.id, name: json.name, size: json.size, mime: json.mime })
			setDraft("")
		} catch (err) {
			toast.error((err as Error).message)
		} finally {
			setUploading(false)
			if (fileRef.current) fileRef.current.value = ""
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-label="Chat messages" aria-live="polite">
				{messages.length === 0 && <p className="pt-10 text-center text-[14px] text-faint">{t("chat.empty")}</p>}
				{messages.map((m, i) => {
					const continued = messages[i - 1]?.fromId === m.fromId
					const mine = m.fromId === youId
					return (
						<div key={m.id} className={cn("flex gap-3", continued && "-mt-2.5")}>
							<div className="w-7 shrink-0">{!continued && <Avatar id={m.fromId} name={m.fromName} />}</div>
							<div className="min-w-0 flex-1">
								{!continued && (
									<p className="mb-0.5 flex items-baseline gap-2">
										<span className="text-[13px] font-medium">{mine ? t("transcript.you") : m.fromName}</span>
										<span className="font-mono text-[10px] text-faint">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
									</p>
								)}
								{m.text && <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{m.text}</p>}
								{m.attachment && (
									<a
										href={`/api/files/${m.attachment.id}`}
										target="_blank"
										rel="noopener noreferrer"
										className="mt-1.5 flex max-w-xs items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 hover:border-border-strong"
									>
										<FileText className="size-5 shrink-0 text-accent" />
										<span className="min-w-0">
											<span className="block truncate text-[13px] font-medium">{m.attachment.name}</span>
											<span className="block font-mono text-[11px] text-faint">{formatSize(m.attachment.size)}</span>
										</span>
									</a>
								)}
							</div>
						</div>
					)
				})}
			</div>
			<form onSubmit={submit} className="m-3 flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface p-1.5">
				<input
					ref={fileRef}
					type="file"
					accept={ACCEPT}
					className="hidden"
					data-testid="chat-file"
					onChange={(e) => {
						const f = e.target.files?.[0]
						if (f) void upload(f)
					}}
				/>
				<button
					type="button"
					onClick={() => fileRef.current?.click()}
					disabled={disabled || uploading}
					aria-label={t("chat.attach")}
					className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
				>
					{uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
				</button>
				<input
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					maxLength={2000}
					placeholder={t("chat.placeholder")}
					aria-label="Chat message"
					disabled={disabled}
					className="h-9 min-w-0 flex-1 bg-transparent px-1 text-[14px] placeholder:text-faint focus:outline-none"
				/>
				<button type="submit" disabled={disabled || !draft.trim()} aria-label={t("chat.send")} className="grid size-9 shrink-0 place-items-center rounded-lg bg-text text-white disabled:bg-surface-2 disabled:text-faint">
					<ArrowUp className="size-4" />
				</button>
			</form>
		</div>
	)
}
