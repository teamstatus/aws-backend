import {
	ConditionalCheckFailedException,
	DeleteItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { CoreEvent } from '../CoreEvent.ts'
import { CoreEventType } from '../CoreEventType.ts'
import {
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import type { UserAuthContext } from '../auth.ts'
import type { Notify } from '../notifier.ts'
import type { DbContext } from './DbContext.ts'

type ReactionDeletedEvent = CoreEvent & {
	type: CoreEventType.REACTION_DELETED
	id: string
}

export const deleteReaction =
	(dbContext: DbContext, notify: Notify) =>
	async (
		reactionId: string,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { deleted: true }> => {
		try {
			const { sub: userId } = authContext
			const { db, TableName } = dbContext
			await db.send(
				new DeleteItemCommand({
					TableName,
					Key: {
						id: {
							S: reactionId,
						},
						type: {
							S: 'statusReaction',
						},
					},
					ConditionExpression: '#author = :author',
					ExpressionAttributeNames: {
						'#author': 'author',
					},
					ExpressionAttributeValues: {
						':author': {
							S: userId,
						},
					},
				}),
			)
			const event: ReactionDeletedEvent = {
				type: CoreEventType.REACTION_DELETED,
				id: reactionId,
				timestamp: new Date(),
			}
			await notify(event)
			return { deleted: true }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: ConflictError(`Failed to delete reaction.`),
				}
			}
			return { error: InternalError() }
		}
	}
