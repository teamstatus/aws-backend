import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
import type { Reaction } from './createReaction.js'
import { canWriteToProject } from './getProjectMember.js'
import { l } from './l.js'

type StatusCreatedEvent = CoreEvent & {
	type: CoreEventType.STATUS_CREATED
} & Status

export type Status = {
	project: string
	author: string
	message: string
	id: string
	version: number
	updatedAt?: Date
	reactions: Reaction[]
}

export const createStatus =
	(dbContext: DbContext, notify: Notify) =>
	async (
		id: string,
		projectId: string,
		message: string,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { sub: userId } = authContext
		if (!(await canWriteToProject(dbContext)(projectId, userId))) {
			return {
				error: BadRequestError(
					`Only members of '${projectId}' are allowed to create status.`,
				),
			}
		}

		const { db, TableName } = dbContext
		await db.send(
			new PutItemCommand({
				TableName,
				Item: {
					id: {
						S: id,
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
				ConditionExpression: 'attribute_not_exists(id)',
			}),
		)
		const event: StatusCreatedEvent = {
			type: CoreEventType.STATUS_CREATED,
			message,
			author: userId,
			id,
			version: 1,
			project: projectId,
			reactions: [],
			timestamp: new Date(),
		}
		notify(event)
		return {}
	}
