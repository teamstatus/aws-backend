import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import type { UserAuthContext } from '../auth.ts'
import type { CoreEvent } from '../CoreEvent.ts'
import { CoreEventType } from '../CoreEventType.ts'
import type { Notify } from '../notifier.ts'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.ts'
import type { Reaction } from './createReaction.ts'
import type { DbContext } from './DbContext.ts'
import { canWriteStatus } from './getProjectMember.ts'
import { l } from './l.ts'

type StatusCreatedEvent = CoreEvent & {
	type: CoreEventType.STATUS_CREATED
} & Status

export type Status = {
	project: string
	author: string
	message: string
	attributeTo?: string
	id: string
	version: number
	updatedAt?: Date
	reactions: Reaction[]
}

export const createStatus =
	(dbContext: DbContext, notify: Notify) =>
	async (
		{
			id,
			projectId,
			message,
			attributeTo,
		}: {
			id: string
			projectId: string
			message: string
			attributeTo?: string
		},
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { sub: userId } = authContext
		if (!(await canWriteStatus(dbContext)(projectId, userId))) {
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
					attributeTo:
						attributeTo === undefined ? { NULL: true } : { S: attributeTo },
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
			attributeTo,
			author: userId,
			id,
			version: 1,
			project: projectId,
			reactions: [],
			timestamp: new Date(),
		}
		await notify(event)
		return {}
	}
