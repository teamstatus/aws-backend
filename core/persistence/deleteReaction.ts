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
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'

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
				new UpdateItemCommand({
					TableName,
					Key: {
						id: {
							S: reactionId,
						},
						type: {
							S: 'statusReaction',
						},
					},
					UpdateExpression:
						'SET #statusDeleted = #status, #deletedAt = :now REMOVE #status',
					ConditionExpression: '#author = :author',
					ExpressionAttributeNames: {
						'#author': 'author',
						'#deletedAt': 'deletedAt',
						'#status': 'statusReaction__status',
						'#statusDeleted': 'statusReaction__status__DELETED',
					},
					ExpressionAttributeValues: {
						':author': {
							S: userId,
						},
						':now': {
							S: new Date().toISOString(),
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
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Failed to delete reaction.`),
				}
			console.error(error)
			return { error: InternalError() }
		}
	}
