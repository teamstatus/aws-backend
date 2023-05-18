import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
	CoreEventType,
	l,
	type AuthContext,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core.js'
import type { PersistedStatus } from './createStatus.js'

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
		{ sub: userId }: AuthContext,
	): Promise<{ error: Error } | { status: PersistedStatus }> => {
		try {
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
