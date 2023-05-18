import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { CoreEventType, l, type CoreEvent, type DbContext } from '../core.js'
import { isUserId } from '../ids.js'
import type { Notify } from '../notifier.js'
import type { VerifyTokenFn } from '../token.js'

export type PersistedUser = { id: string; email: string; name: string | null }

export type UserCreatedEvent = CoreEvent & {
	type: CoreEventType.USER_CREATED
	id: string
	email: string
}

export const createUser =
	(verifyToken: VerifyTokenFn, dbContext: DbContext, notify: Notify) =>
	async ({
		id: userId,
		name,
		token,
	}: {
		id: string
		name?: string
		token: string
	}): Promise<{ error: Error } | { user: PersistedUser }> => {
		const { email } = verifyToken(token)
		if (!isUserId(userId))
			return {
				error: new Error(`Not an user ID: ${userId}`),
			}
		try {
			const { db, table } = dbContext
			await db.send(
				new PutItemCommand({
					TableName: table,
					Item: {
						id: {
							S: l(userId),
						},
						type: {
							S: 'user',
						},
						user__email: { S: email },
						name:
							name !== undefined
								? {
										S: name,
								  }
								: { NULL: true },
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			const user: PersistedUser = {
				id: userId,
				email,
				name: name ?? null,
			}
			const event: UserCreatedEvent = {
				type: CoreEventType.USER_CREATED,
				...user,
				timestamp: new Date(),
			}
			notify(event)
			return { user }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: new Error(`User '${userId}' already exists.`),
				}
			return { error: error as Error }
		}
	}
