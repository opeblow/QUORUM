import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Input({ className, ...props }: ComponentProps<"input">) {
	return (
		<input
			className={cn(
				"h-11 w-full rounded-lg border border-border-strong bg-surface px-3.5 text-[15px] text-text placeholder:text-faint transition-colors focus-visible:border-text focus-visible:outline-none",
				className,
			)}
			{...props}
		/>
	)
}

export function Label({ className, ...props }: ComponentProps<"label">) {
	return <label className={cn("text-[13px] font-medium text-muted", className)} {...props} />
}
