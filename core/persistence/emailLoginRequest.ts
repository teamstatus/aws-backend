import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.js'
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

export const emailLoginRequest =
	(dbContext: DbContext, notify: Notify) =>
	async ({
		email,
	}: {
		email: string
	}): Promise<
		{ error: ProblemDetail } | { loginRequest: EmailLoginRequest; pin: string }
	> => {
		try {
			const { db, TableName } = dbContext
			const pin = generatePIN()
			// Expires in 5 Minutes
			const expires = new Date(Date.now() + 5 * 60 * 1000)
			// Rerequest after 1 Minute
			const rerequestAfter = new Date(Date.now() + 1 * 60 * 1000)
			await db.send(
				new UpdateItemCommand({
					TableName,
					Key: {
						id: {
							S: email,
						},
						type: {
							S: 'emailLoginRequest',
						},
					},
					UpdateExpression:
						'SET #pin = :pin, #ttl = :ttl, #rerequestAfter = :rerequestAfter',
					ConditionExpression:
						'attribute_not_exists(id) OR #ttl < :now OR #rerequestAfter < :now',
					ExpressionAttributeNames: {
						'#pin': 'pin',
						'#ttl': 'ttl',
						'#rerequestAfter': 'rerequestAfter',
					},
					ExpressionAttributeValues: {
						':pin': {
							S: pin,
						},
						':ttl': {
							N: `${Math.floor(expires.getTime() / 1000)}`,
						},
						':rerequestAfter': {
							N: `${Math.floor(rerequestAfter.getTime() / 1000)}`,
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
					error: ConflictError(`Login requests for '${email}' already exists.`),
				}
			console.error((error as Error).message)
			return { error: InternalError() }
		}
	}
