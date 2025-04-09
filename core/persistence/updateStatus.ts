import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
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

type StatusUpdatedEvent = CoreEvent & {
	type: CoreEventType.STATUS_UPDATED
	id: string
	version: number
	message: string
}

export const updateStatus =
	(dbContext: DbContext, notify: Notify) =>
	async (
		statusId: string,
		message: string,
		version: number,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		try {
			const { sub: userId } = authContext
			const { db, TableName } = dbContext
			const { Attributes } = await db.send(
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
					UpdateExpression: 'SET #message = :message, #version = :newVersion',
					ConditionExpression: '#version = :version AND #author = :author',
					ExpressionAttributeNames: {
						'#message': 'message',
						'#version': 'version',
						'#author': 'author',
					},
					ExpressionAttributeValues: {
						':message': {
							S: message,
						},
						':version': {
							N: `${version}`,
						},
						':newVersion': {
							N: `${version + 1}`,
						},
						':author': {
							S: l(userId),
						},
					},
					ReturnValues: 'ALL_NEW',
				}),
			)
			if (Attributes === undefined) {
				return { error: ConflictError('Update failed.') }
			}
			const updated = unmarshall(Attributes)
			const event: StatusUpdatedEvent = {
				type: CoreEventType.STATUS_UPDATED,
				id: statusId,
				message,
				version: updated.version,
				timestamp: new Date(),
			}
			await notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: ConflictError(`Failed to update status.`),
				}
			}
			return { error: InternalError() }
		}
	}
