import {
	ConditionalCheckFailedException,
	DeleteItemCommand,
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
import { l } from './l.js'

type SyncDeletedEvent = CoreEvent & {
	type: CoreEventType.SYNC_DELETED
	id: string
}

export const deleteSync =
	(dbContext: DbContext, notify: Notify) =>
	async (
		syncId: string,
		version: number,
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
							S: syncId,
						},
						type: {
							S: 'projectSync',
						},
					},
					ConditionExpression: '#owner = :owner AND #version = :version',
					ExpressionAttributeNames: {
						'#owner': 'sync__owner',
						'#version': 'version',
					},
					ExpressionAttributeValues: {
						':owner': {
							S: l(userId),
						},
						':version': {
							N: `${version}`,
						},
					},
				}),
			)
			const event: SyncDeletedEvent = {
				type: CoreEventType.SYNC_DELETED,
				id: syncId,
				timestamp: new Date(),
			}
			await notify(event)

			// FIXME: Delete project index

			return { deleted: true }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Failed to delete sync.`),
				}
			console.error(error)
			return { error: InternalError() }
		}
	}
