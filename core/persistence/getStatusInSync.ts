import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
	BadRequestError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail'
import type { UserAuthContext } from '../auth'
import type { DbContext } from './DbContext'
import { canReadProjects } from './canReadProjects'
import type { Status } from './createStatus'
import { listStatus } from './listStatus'

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
				ProjectionExpression: '#projectIds',
				ExpressionAttributeNames: {
					'#projectIds': 'projectIds',
				},
			}),
		)

		if (sync === undefined)
			return { error: NotFoundError(`Sync ${syncId} not found!`) }

		const { projectIds } = unmarshall(sync) as { projectIds: string[] }

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
			[...projectIds].map((projectId) =>
				listStatus({ db, TableName })(projectId, authContext),
			),
		)

		return {
			status: maybeStatus
				.filter((res) => 'status' in res)
				.map((res) => (res as { status: Status[] }).status)
				.flat(),
		}
	}
