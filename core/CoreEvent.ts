import { CoreEventType } from './CoreEventType.js'

export type CoreEvent = {
	type: CoreEventType
	timestamp: Date
}
