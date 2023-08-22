import type { CoreEvent } from './CoreEvent.js'
import type { CoreEventType } from './CoreEventType.js'

export type listenerFn = (event: CoreEvent) => Promise<unknown>

export type Notify = (event: CoreEvent) => Promise<void>

export type onFn = (event: CoreEventType | '*', fn: listenerFn) => void

export const notifier = (): {
	notify: Notify
	on: onFn
} => {
	const listeners: { event: CoreEventType | '*'; fn: listenerFn }[] = []
	const notify = async (event: CoreEvent) => {
		const listenersToCall = [
			...listeners.filter(({ event }) => event === '*'),
			...listeners.filter(({ event: e }) => e === event.type),
		].map(({ fn }) => fn)
		await Promise.all(listenersToCall.map(async (fn) => fn(event)))
	}
	return {
		notify,
		on: (event, fn) => {
			listeners.push({ event, fn })
		},
	}
}
