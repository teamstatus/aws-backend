import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { EmailAuthContext } from '../auth.ts'
import type { CoreEvent } from '../CoreEvent.ts'
import { CoreEventType } from '../CoreEventType.ts'
import { isUserId } from '../ids.ts'
import type { Notify } from '../notifier.ts'
import {
	BadRequestError,
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import type { DbContext } from './DbContext.ts'
import { l } from './l.ts'

export type User = {
	id: string
	email: string
	name?: string
	version: number
	pronouns?: string
}

export type UserCreatedEvent = CoreEvent & {
	type: CoreEventType.USER_CREATED
} & User

export const createUser =
	(dbContext: DbContext, notify: Notify) =>
	async ({
		id: userId,
		name,
		pronouns,
		authContext,
	}: {
		id: string
		name?: string
		pronouns?: string
		authContext: EmailAuthContext
	}): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { email } = authContext
		if (!isUserId(userId)) {
			return {
				error: BadRequestError(`Not an user ID: ${userId}`),
			}
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
						user__email: { S: l(email) },
						name:
							name !== undefined
								? {
										S: name,
									}
								: { NULL: true },
						pronouns:
							pronouns !== undefined
								? {
										S: pronouns,
									}
								: { NULL: true },
						version: {
							N: `1`,
						},
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			const event: UserCreatedEvent = {
				type: CoreEventType.USER_CREATED,
				id: userId,
				email,
				pronouns,
				name,
				timestamp: new Date(),
				version: 1,
			}

			await notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: ConflictError(`User '${userId}' already exists.`),
				}
			}
			return { error: InternalError() }
		}
	}
