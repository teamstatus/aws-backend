import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import {
	BadRequestError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import type { UserAuthContext } from '../auth.ts'
import type { DbContext } from './DbContext.ts'
import type { Status } from './createStatus.ts'
import { canReadProjectStatus } from './getProjectMember.ts'
import { itemToStatus } from './listStatus.ts'

export const getStatus =
	(dbContext: DbContext) =>
	async (
		{
			projectId,
			statusId,
		}: {
			projectId: string
			statusId: string
		},
		authContext: UserAuthContext,
	): Promise<{ status: Status } | { error: ProblemDetail }> => {
		const { sub: userId } = authContext
		if (!(await canReadProjectStatus(dbContext)(projectId, userId))) {
			return {
				error: BadRequestError(
					`Only members of '${projectId}' are allowed to list status.`,
				),
			}
		}

		const { db, TableName } = dbContext

		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: statusId,
					},
					type: {
						S: 'projectStatus',
					},
				},
			}),
		)

		if (Item === undefined) {
			return {
				error: NotFoundError(`Status ${statusId} not found!`),
			}
		}

		return {
			status: await itemToStatus(dbContext)(Item),
		}
	}
