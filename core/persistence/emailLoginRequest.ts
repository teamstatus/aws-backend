import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import {
	CoreEventType,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core.js'
import { generatePIN } from './generatePIN.js'

export type EmailLoginRequestedEvent = CoreEvent & {
	type: CoreEventType.EMAIL_LOGIN_REQUESTED
	pin: string
} & EmailLoginRequest

export type EmailLoginRequest = {
	email: string
	expires: Date
}

// FIXME: do not allow to request multiple
export const emailLoginRequest =
	(dbContext: DbContext, notify: Notify) =>
	async ({
		email,
	}: {
		email: string
	}): Promise<
		{ error: Error } | { loginRequest: EmailLoginRequest; pin: string }
	> => {
		const { db, table } = dbContext
		const pin = generatePIN()
		const expires = new Date(Date.now() + 60 * 1000)
		await db.send(
			new PutItemCommand({
				TableName: table,
				Item: {
					id: {
						S: email,
					},
					type: {
						S: 'emailLoginRequest',
					},
					pin: {
						S: pin,
					},
					ttl: {
						N: `${Math.floor(expires.getTime() / 1000)}`,
					},
				},
			}),
		)
		const loginRequest: EmailLoginRequest = {
			email,
			expires,
		}
		const event: EmailLoginRequestedEvent = {
			type: CoreEventType.EMAIL_LOGIN_REQUESTED,
			...loginRequest,
			pin,
			timestamp: new Date(),
		}
		notify(event)
		return { loginRequest, pin }
	}
