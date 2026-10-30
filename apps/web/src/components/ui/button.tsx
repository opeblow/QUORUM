import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

// Adapted from shadcn/ui (MIT) to Quorum's dark system.
const buttonVariants = cva(
	"relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				primary: "bg-text text-white hover:bg-[#2b2b29]",
				brand: "bg-text text-white hover:bg-[#2b2b29]",
				accent: "bg-accent text-white hover:bg-[#cf4f0b]",
				secondary: "border border-border-strong bg-surface text-text hover:bg-surface-2",
				ghost: "text-muted hover:text-text hover:bg-surface-2",
				danger: "border border-bad/40 bg-surface text-bad hover:bg-bad/5",
				ok: "border border-ok/40 bg-surface text-ok hover:bg-ok/5",
			},
			size: {
				sm: "h-8 px-3 text-[13px]",
				md: "h-10 px-5",
				lg: "h-11 px-5 text-[15px]",
				icon: "size-10",
			},
		},
		defaultVariants: { variant: "primary", size: "md" },
	},
)

export function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "button"
	return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
