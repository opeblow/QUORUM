import { cn } from "@/lib/utils"

const HUES = ["#0a0a0a", "#27272a", "#3f3f46", "#52525b", "#18181b", "#71717a"]

function hueFor(seed: string): string {
	let h = 0
	for (const ch of seed) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
	return HUES[h % HUES.length] ?? "#8b5cf6"
}

export function initials(name: string): string {
	// Ignore annotations like "(you)" so "Ana Petrović (you)" reads "AP".
	const parts = name.replace(/\(.*?\)/gu, "").trim().split(/\s+/u).filter(Boolean)
	return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?"
}

/** Deterministic colour per person so speakers are recognisable at a glance. */
export function Avatar({ id, name, className }: { id: string; name: string; className?: string }) {
	const hue = hueFor(id)
	return (
		<span
			className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white", className)}
			style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 45%, #000))` }}
			aria-hidden
		>
			{initials(name)}
		</span>
	)
}

export function AvatarStack({ people, max = 4 }: { people: Array<{ id: string; name: string }>; max?: number }) {
	const shown = people.slice(0, max)
	const rest = people.length - shown.length
	return (
		<div className="flex -space-x-2" title={people.map((p) => p.name).join(", ")}>
			{shown.map((p) => (
				<Avatar key={p.id} id={p.id} name={p.name} />
			))}
			{rest > 0 && (
				<span className="grid size-7 place-items-center rounded-full bg-surface-3 text-[10px] font-medium text-muted ring-2 ring-white">+{rest}</span>
			)}
		</div>
	)
}
