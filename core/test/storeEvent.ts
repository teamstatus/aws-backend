import type { CoreEvent } from '../CoreEvent.ts'
import type { listenerFn } from '../notifier.ts'

export const storeEvent =
	(events: CoreEvent[]): listenerFn =>
	async (e: CoreEvent) => {
		events.push(e)
	}
