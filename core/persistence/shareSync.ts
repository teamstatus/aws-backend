import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
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
import { l } from './l.js'

type SyncSharedEvent = CoreEvent & {
	type: CoreEventType.SYNC_SHARED
	id: string
	version: number
	sharingToken: string
}

export const shareSync =
	(dbContext: DbContext, notify: Notify) =>
	async (
		syncId: string,
		sharingToken: string,
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
							S: syncId,
						},
						type: {
							S: 'projectSync',
						},
					},
					UpdateExpression:
						'SET #sharingToken = :sharingToken, #version = :newVersion',
					ConditionExpression: '#version = :version AND #owner = :owner',
					ExpressionAttributeNames: {
						'#sharingToken': 'sharingToken',
						'#version': 'version',
						'#owner': 'sync__owner',
					},
					ExpressionAttributeValues: {
						':sharingToken': {
							S: sharingToken,
						},
						':version': {
							N: `${version}`,
						},
						':newVersion': {
							N: `${version + 1}`,
						},
						':owner': {
							S: l(userId),
						},
					},
					ReturnValues: 'ALL_NEW',
				}),
			)
			if (Attributes === undefined)
				return { error: ConflictError('Update failed.') }
			const updated = unmarshall(Attributes)
			const event: SyncSharedEvent = {
				type: CoreEventType.SYNC_SHARED,
				id: syncId,
				sharingToken,
				version: updated.version,
				timestamp: new Date(),
			}
			notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Failed to update sync.`),
				}
			console.error((error as Error).message)
			return { error: InternalError() }
		}
	}
