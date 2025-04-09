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
import { l } from './l.ts'

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
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: ConflictError(`Failed to delete sync.`),
				}
			}
			return { error: InternalError() }
		}
	}
