import type { CoreEvent } from './CoreEvent.js'
import type { CoreEventType } from './CoreEventType.js'

export type listenerFn = (event: CoreEvent, replay: boolean) => Promise<unknown>

export type Notify = (event: CoreEvent, replay?: boolean) => Promise<void>

export type onFn = (event: CoreEventType | '*', fn: listenerFn) => void

export const notifier = (): {
	notify: Notify
	on: onFn
} => {
	const listeners: { event: CoreEventType | '*'; fn: listenerFn }[] = []
	const notify: Notify = async (event, replay = false) => {
		const listenersToCall = [
			...listeners.filter(({ event }) => event === '*'),
			...listeners.filter(({ event: e }) => e === event.type),
		].map(({ fn }) => fn)
		await Promise.all(listenersToCall.map(async (fn) => fn(event, replay)))
	}
	return {
		notify,
		on: (event, fn) => {
			listeners.push({ event, fn })
		},
	}
}
