import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import { verifyULID } from '../verifyULID.js'
import { type DbContext } from './DbContext.js'
import type { PersistedReaction } from './createReaction.js'
import { isProjectMember } from './getProjectMember.js'
import { l } from './l.js'

type StatusCreatedEvent = CoreEvent & {
	type: CoreEventType.STATUS_CREATED
} & PersistedStatus

export type PersistedStatus = {
	project: string
	author: string
	message: string
	id: string
	version: number
	updatedAt?: Date
	reactions: PersistedReaction[]
}

export const createStatus =
	(dbContext: DbContext, notify: Notify) =>
	async (
		id: string,
		projectId: string,
		message: string,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { status: PersistedStatus }> => {
		const { sub: userId } = authContext
		if (!(await isProjectMember(dbContext)(projectId, userId))) {
			return {
				error: BadRequestError(
					`Only members of '${projectId}' are allowed to create status.`,
				),
			}
		}

		const { db, table } = dbContext
		await db.send(
			new PutItemCommand({
				TableName: table,
				Item: {
					id: {
						S: verifyULID(id),
					},
					type: {
						S: 'projectStatus',
					},
					projectStatus__project: {
						S: l(projectId),
					},
					author: {
						S: l(userId),
					},
					message: {
						S: message,
					},
					version: {
						N: `1`,
					},
				},
			}),
		)
		const status: PersistedStatus = {
			message,
			author: userId,
			id,
			version: 1,
			project: projectId,
			reactions: [],
		}
		const event: StatusCreatedEvent = {
			type: CoreEventType.STATUS_CREATED,
			...status,
			timestamp: new Date(),
		}
		notify(event)
		return { status }
	}
