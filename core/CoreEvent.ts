import type { CoreEventType } from './CoreEventType.ts'

export type CoreEvent = {
	type: CoreEventType
	timestamp: Date
}
