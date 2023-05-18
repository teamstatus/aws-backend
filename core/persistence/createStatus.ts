import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { ulid } from 'ulid'
import { CoreEventType, l, type CoreEvent, type DbContext } from '../core.js'
import type { Notify } from '../notifier.js'
import type { VerifyTokenUserFn } from '../token.js'
import type { PersistedReaction } from './createReaction.js'
import { isProjectMember } from './getProjectMember.js'

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
	(verifyToken: VerifyTokenUserFn, dbContext: DbContext, notify: Notify) =>
	async (
		projectId: string,
		message: string,
		token: string,
	): Promise<{ error: Error } | { status: PersistedStatus }> => {
		const { sub: userId } = verifyToken(token)
		if (!(await isProjectMember(dbContext)(projectId, userId))) {
			return {
				error: new Error(
					`Only members of '${projectId}' are allowed to create status.`,
				),
			}
		}

		const id = ulid()

		const { db, table } = dbContext
		await db.send(
			new PutItemCommand({
				TableName: table,
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
