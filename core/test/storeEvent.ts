import type { CoreEvent } from '../CoreEvent.ts'
import type { listenerFn } from '../notifier.ts'

export const storeEvent =
	(events: CoreEvent[]): listenerFn =>
	// biome-ignore lint/suspicious/useAwait: test implementation
	async (e: CoreEvent) => {
		events.push(e)
	}
