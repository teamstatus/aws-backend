import type { CoreEvent } from '../CoreEvent.js'
import { type listenerFn } from '../notifier.js'

export const storeEvent =
	(events: CoreEvent[]): listenerFn =>
	async (e: CoreEvent) => {
		events.push(e)
	}
