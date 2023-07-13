import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { NotFoundError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { DbContext } from './DbContext.js'
import type { Status } from './createStatus.js'
import { listStatus } from './listStatus.js'
import { itemToSync, projectsInSyncForUser } from './getSync.js'

export const listStatusInSync =
	(dbContext: DbContext) =>
	async (
		syncId: string,
		authContext: UserAuthContext,
	): Promise<{ status: Status[] } | { error: ProblemDetail }> => {
		const { db, TableName } = dbContext
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: syncId,
					},
					type: {
						S: 'projectSync',
					},
				},
				ProjectionExpression:
					'#projectIds, #inclusiveStartDate, #inclusiveEndDate',
				ExpressionAttributeNames: {
					'#projectIds': 'projectIds',
					'#inclusiveStartDate': 'inclusiveStartDate',
					'#inclusiveEndDate': 'inclusiveEndDate',
				},
			}),
		)

		if (Item === undefined)
			return { error: NotFoundError(`Sync ${syncId} not found!`) }

		const sync = itemToSync(unmarshall(Item))

		const maybeProjectIds = await projectsInSyncForUser(dbContext)(
			sync,
			authContext,
		)
		if ('error' in maybeProjectIds) return maybeProjectIds

		const { projectIds, inclusiveStartDate, inclusiveEndDate } = sync

		const maybeStatus = await Promise.all(
			[...projectIds].map(async (projectId) =>
				listStatus({ db, TableName })(
					{
						projectId,
						inclusiveStartDate,
						inclusiveEndDate,
					},
					authContext,
				),
			),
		)

		return {
			status: maybeStatus
				.filter((res) => 'status' in res)
				.map((res) => (res as { status: Status[] }).status)
				.flat(),
		}
	}
