"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function CopyMarkdownButton({ markdown }: { markdown: string }) {
	const [copied, setCopied] = useState(false)
	return (
		<Button
			size="sm"
			variant="secondary"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(markdown)
					setCopied(true)
					setTimeout(() => setCopied(false), 1800)
				} catch {
					toast.error("Couldn't access the clipboard")
				}
			}}
		>
			{copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy as Markdown"}
		</Button>
	)
}
