import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import type { DbContext } from './DbContext.js'
import type { User } from './createUser.js'
import { unmarshall } from '@aws-sdk/util-dynamodb'

export type UserUpdatedEvent = CoreEvent & {
	type: CoreEventType.USER_UPDATED
	version: number
} & Pick<User, 'id' | 'name' | 'pronouns'>

export const updateUser =
	(dbContext: DbContext, notify: Notify) =>
	async (
		update: Pick<User, 'name' | 'pronouns'>,
		version: number,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		try {
			const { db, TableName } = dbContext
			const { Attributes } = await db.send(
				new UpdateItemCommand({
					TableName,
					Key: {
						id: {
							S: authContext.sub,
						},
						type: {
							S: 'user',
						},
					},
					UpdateExpression:
						'SET #name = :name, #pronouns = :pronouns, #version = :newVersion',
					ConditionExpression: '#version = :version',
					ExpressionAttributeNames: {
						'#name': 'name',
						'#pronouns': 'pronouns',
						'#version': 'version',
					},
					ExpressionAttributeValues: {
						':name':
							update.name !== undefined
								? {
										S: update.name,
								  }
								: { NULL: true },
						':pronouns':
							update.pronouns !== undefined
								? {
										S: update.pronouns,
								  }
								: { NULL: true },
						':version': {
							N: `${version}`,
						},
						':newVersion': {
							N: `${version + 1}`,
						},
					},
					ReturnValues: 'ALL_NEW',
				}),
			)
			if (Attributes === undefined)
				return { error: ConflictError('Update failed.') }
			const updated = unmarshall(Attributes)
			const event: UserUpdatedEvent = {
				type: CoreEventType.USER_UPDATED,
				id: authContext.sub,
				name: update.name,
				pronouns: update.pronouns,
				version: updated.version,
				timestamp: new Date(),
			}
			await notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Failed to update user.`),
				}
			console.error(error)
			return { error: InternalError() }
		}
	}
