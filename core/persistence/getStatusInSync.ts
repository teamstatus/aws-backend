import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
	BadRequestError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth'
import type { DbContext } from './DbContext.js'
import { canReadProjects } from './canReadProjects.js'
import type { Status } from './createStatus.js'
import { listStatus } from './listStatus.js'

export const getStatusInSync =
	(dbContext: DbContext, authContext: UserAuthContext) =>
	async (
		syncId: string,
	): Promise<{ status: Status[] } | { error: ProblemDetail }> => {
		const { db, TableName } = dbContext
		const { Item: sync } = await db.send(
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
				ProjectionExpression: '#projectIds, #inclusiveStartDate',
				ExpressionAttributeNames: {
					'#projectIds': 'projectIds',
					'#inclusiveStartDate': 'inclusiveStartDate',
				},
			}),
		)

		if (sync === undefined)
			return { error: NotFoundError(`Sync ${syncId} not found!`) }

		const { projectIds, inclusiveStartDate } = unmarshall(sync) as {
			projectIds: string[]
			inclusiveStartDate: null | string
		}

		if (!(await canReadProjects(dbContext)([...projectIds], authContext))) {
			return {
				error: BadRequestError(
					`Only members of '${projectIds.join(
						',',
					)}' are allowed to create a sync.`,
				),
			}
		}

		const maybeStatus = await Promise.all(
			[...projectIds].map(async (projectId) =>
				listStatus({ db, TableName })(
					{
						projectId,
						inclusiveStartDate:
							inclusiveStartDate === null
								? undefined
								: new Date(inclusiveStartDate),
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
