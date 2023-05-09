import {
	ConditionalCheckFailedException,
	DeleteItemCommand,
} from '@aws-sdk/client-dynamodb'
import {
	CoreEventType,
	type AuthContext,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core.js'

type StatusDeletedEvent = CoreEvent & {
	type: CoreEventType.STATUS_DELETED
	id: string
}

export const deleteStatus =
	(dbContext: DbContext, notify: Notify) =>
	async (
		statusId: string,
		{ userId }: AuthContext,
	): Promise<{ error: Error } | { deleted: true }> => {
		try {
			const { db, table } = dbContext
			await db.send(
				new DeleteItemCommand({
					TableName: table,
					Key: {
						id: {
							S: statusId,
						},
						type: {
							S: 'projectStatus',
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
			const event: StatusDeletedEvent = {
				type: CoreEventType.STATUS_DELETED,
				id: statusId,
				timestamp: new Date(),
			}
			notify(event)
			return { deleted: true }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: new Error(`Failed to delete status.`),
				}
			return { error: error as Error }
		}
	}
