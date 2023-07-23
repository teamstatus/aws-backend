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

type StatusDeletedEvent = CoreEvent & {
	type: CoreEventType.STATUS_DELETED
	id: string
}

export const deleteStatus =
	(dbContext: DbContext, notify: Notify) =>
	async (
		statusId: string,
		version: number,
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
							S: statusId,
						},
						type: {
							S: 'projectStatus',
						},
					},
					UpdateExpression:
						'SET #projectDeleted = #project, #deletedAt = :now, #version = :newVersion REMOVE #project',
					ConditionExpression: '#author = :author AND #version = :version',
					ExpressionAttributeNames: {
						'#author': 'author',
						'#deletedAt': 'deletedAt',
						'#project': 'projectStatus__project',
						'#projectDeleted': 'projectStatus__project__DELETED',
						'#version': 'version',
					},
					ExpressionAttributeValues: {
						':author': {
							S: userId,
						},
						':now': {
							S: new Date().toISOString(),
						},
						':version': {
							N: `${version}`,
						},
						':newVersion': {
							N: `${version + 1}`,
						},
					},
				}),
			)
			const event: StatusDeletedEvent = {
				type: CoreEventType.STATUS_DELETED,
				id: statusId,
				timestamp: new Date(),
			}
			await notify(event)
			return { deleted: true }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Failed to delete status.`),
				}
			console.error(error)
			return { error: InternalError() }
		}
	}
