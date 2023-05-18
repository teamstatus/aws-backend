import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
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
		try {
			const { db, table } = dbContext
			const pin = generatePIN()
			const expires = new Date(Date.now() + 60 * 1000)
			await db.send(
				new UpdateItemCommand({
					TableName: table,
					Key: {
						id: {
							S: email,
						},
						type: {
							S: 'emailLoginRequest',
						},
					},
					UpdateExpression: 'SET #pin = :pin, #ttl = :ttl',
					ConditionExpression: 'attribute_not_exists(id) OR #ttl < :now',
					ExpressionAttributeNames: {
						'#pin': 'pin',
						'#ttl': 'ttl',
					},
					ExpressionAttributeValues: {
						':pin': {
							S: pin,
						},
						':ttl': {
							N: `${Math.floor(expires.getTime() / 1000)}`,
						},
						':now': {
							N: `${Math.floor(Date.now() / 1000)}`,
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
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: new Error(`Login requests for '${email}' already exists.`),
				}
			return { error: error as Error }
		}
	}
