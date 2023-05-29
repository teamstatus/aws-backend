import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	BadRequestError,
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import type { EmailAuthContext } from '../auth.js'
import { isUserId } from '../ids.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
import { l } from './l.js'

export type User = { id: string; email: string; name: string }

export type UserCreatedEvent = CoreEvent & {
	type: CoreEventType.USER_CREATED
	id: string
	email: string
	name: string
}

export const createUser =
	(dbContext: DbContext, notify: Notify) =>
	async ({
		id: userId,
		name,
		authContext,
	}: {
		id: string
		name: string
		authContext: EmailAuthContext
	}): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { email } = authContext
		if (!isUserId(userId))
			return {
				error: BadRequestError(`Not an user ID: ${userId}`),
			}
		try {
			const { db, TableName } = dbContext
			await db.send(
				new PutItemCommand({
					TableName,
					Item: {
						id: {
							S: l(userId),
						},
						type: {
							S: 'user',
						},
						user__email: { S: email },
						name: {
							S: name,
						},
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			const event: UserCreatedEvent = {
				type: CoreEventType.USER_CREATED,
				id: userId,
				email,
				name,
				timestamp: new Date(),
			}
			notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`User '${userId}' already exists.`),
				}
			console.error((error as Error).message)
			return { error: InternalError() }
		}
	}
