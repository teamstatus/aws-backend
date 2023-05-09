import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import {
	CoreEventType,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core'

export type EmailLoginRequestedEvent = CoreEvent & {
	type: CoreEventType.EMAIL_LOGIN_REQUESTED
	pin: string
} & EmailLoginRequest

export type EmailLoginRequest = {
	email: string
	expires: Date
}

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
						N: `${Math.floor(expires.getTime())}`,
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

const generatePIN = (length = 8): string => {
	let pin = ''
	do {
		pin = `${pin}${crypto.randomUUID()}`
			.split('')
			.filter((s) => /[0-9]/.test(s))
			.join('')
	} while (pin.length < length)
	return pin.slice(0, length - 1)
}
