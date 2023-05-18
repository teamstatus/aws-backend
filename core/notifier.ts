import type { CoreEvent, CoreEventType } from './core'

export type listenerFn = (event: CoreEvent) => unknown

export type Notify = (event: CoreEvent) => void

export type onFn = (event: CoreEventType | '*', fn: listenerFn) => void

export const notifier = (): {
	notify: Notify
	on: onFn
} => {
	const listeners: { event: CoreEventType | '*'; fn: listenerFn }[] = []
	const notify = (event: CoreEvent) => {
		for (const { fn } of [
			...listeners.filter(({ event }) => event === '*'),
			...listeners.filter(({ event: e }) => e === event.type),
		]) {
			fn(event)
		}
	}
	return {
		notify,
		on: (event, fn) => {
			listeners.push({ event, fn })
		},
	}
}
