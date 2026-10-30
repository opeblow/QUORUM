import { SituationSpecification, type SituationContext } from "@mozaik-ai/core"

/** Small reusable specifications; agents compose them with the runtime's .and() / .or() / .not(). */

export class EventIs extends SituationSpecification {
	private readonly types: ReadonlySet<string>

	constructor(...types: string[]) {
		super()
		this.types = new Set(types)
	}

	isSatisfiedBy({ event }: SituationContext): boolean {
		return this.types.has(event.type)
	}
}

export class ProducedBySelf extends SituationSpecification {
	isSatisfiedBy({ event, participant }: SituationContext): boolean {
		return event.producerId === participant.getId()
	}
}

export class AnyEvent extends SituationSpecification {
	isSatisfiedBy(): boolean {
		return true
	}
}

/** Lifts a plain predicate (often over shared room state) into a specification. */
export class When extends SituationSpecification {
	constructor(private readonly predicate: (context: SituationContext) => boolean) {
		super()
	}

	isSatisfiedBy(context: SituationContext): boolean {
		return this.predicate(context)
	}
}

export const fromOthers = (): SituationSpecification => new ProducedBySelf().not()
export const fromSelf = (): SituationSpecification => new ProducedBySelf()
