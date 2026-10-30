import { defineRuntime, RuntimeState, type InferenceRunner } from "@mozaik-ai/core"

class DetachedState extends RuntimeState {}

let cached: InferenceRunner | undefined

/**
 * The runtime's default provider runner, complete with its request validator. The validator
 * class is not exported in 4.1.0, so we take the runner a fresh runtime builds for itself.
 * That runtime is never joined or used for anything else.
 */
export function defaultInferenceRunner(): InferenceRunner {
	cached ??= defineRuntime<DetachedState>().initializeRuntime({ state: new DetachedState() }).getInferenceRunner()
	return cached
}
