import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** A plain, precise card: white surface, hairline border, border darkens on hover. */
export function SpotlightCard({
	className,
	children,
	...props
}: ComponentProps<"div"> ) {
	return (
		<div
			className={cn(
				"group relative rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(20_20_19/0.04)] transition-colors hover:border-border-strong",
				className,
			)}
			{...props}
		>
			<div className="relative">{children}</div>
		</div>
	)
}
