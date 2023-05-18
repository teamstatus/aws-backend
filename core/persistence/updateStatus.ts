import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import type { Notify } from '../notifier.js'
import type { VerifyTokenUserFn } from '../token.js'
import { type DbContext } from './DbContext.js'
import type { PersistedStatus } from './createStatus.js'
import { l } from './l.js'

type StatusUpdatedEvent = CoreEvent & {
	type: CoreEventType.STATUS_UPDATED
	id: string
	version: number
	message: string
}

export const updateStatus =
	(verifyToken: VerifyTokenUserFn, dbContext: DbContext, notify: Notify) =>
	async (
		statusId: string,
		message: string,
		version: number,
		token: string,
	): Promise<{ error: Error } | { status: PersistedStatus }> => {
		try {
			const { sub: userId } = verifyToken(token)
			const { db, table } = dbContext
			const { Attributes } = await db.send(
				new UpdateItemCommand({
					TableName: table,
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
			if (Attributes === undefined)
				return { error: new Error(`Update failed.`) }
			const updated = unmarshall(Attributes)
			const status: PersistedStatus = {
				message,
				author: userId,
				id: statusId,
				project: updated.projectStatus__project,
				version: updated.version,
				reactions: [],
			}
			const event: StatusUpdatedEvent = {
				type: CoreEventType.STATUS_UPDATED,
				id: statusId,
				message,
				version: updated.version,
				timestamp: new Date(),
			}
			notify(event)
			return { status }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: new Error(`Failed to update status.`),
				}
			return { error: error as Error }
		}
	}
