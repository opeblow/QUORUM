import { cn } from "@/lib/utils"

/** Five agents around a shared centre — the product in one mark. */
export function Logo({ className }: { className?: string }) {
	const dots = [0, 72, 144, 216, 288].map((deg) => {
		const r = (deg * Math.PI) / 180
		return { x: 12 + 8 * Math.sin(r), y: 12 - 8 * Math.cos(r) }
	})
	return (
		<svg viewBox="0 0 24 24" className={cn("text-accent", className)} aria-hidden="true">
			<circle cx="12" cy="12" r="3.2" fill="currentColor" />
			{dots.map((d, i) => (
				<g key={i}>
					<line x1="12" y1="12" x2={d.x} y2={d.y} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
					<circle cx={d.x} cy={d.y} r="2" fill="currentColor" fillOpacity={0.55 + i * 0.09} />
				</g>
			))}
		</svg>
	)
}
