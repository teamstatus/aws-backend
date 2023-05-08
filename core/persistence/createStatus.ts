import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { ulid } from 'ulid'
import {
	CoreEventType,
	l,
	type AuthContext,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core.js'
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
	reactions: PersistedReaction[]
}

export const createStatus =
	(dbContext: DbContext, notify: Notify) =>
	async (
		projectId: string,
		message: string,
		{ userId }: AuthContext,
	): Promise<{ error: Error } | { status: PersistedStatus }> => {
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
						S: 'status',
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
				},
			}),
		)
		const status: PersistedStatus = {
			message,
			author: userId,
			id,
			project: projectId,
			reactions: [],
		}
		const event: StatusCreatedEvent = {
			type: CoreEventType.STATUS_CREATED,
			...status,
		}
		notify(event)
		return { status }
	}
