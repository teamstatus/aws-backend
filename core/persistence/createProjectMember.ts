import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import { Role } from '../Role.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
import { l } from './l.js'

export type ProjectMemberCreatedEvent = CoreEvent &
	ProjectMember & {
		type: CoreEventType.PROJECT_MEMBER_CREATED
	}

export type ProjectMember = {
	id: string
	project: string
	user: string
	role: Role
}

export const createProjectMember =
	({ db, TableName }: DbContext, notify: Notify) =>
	async (projectId: string, userId: string, role: Role): Promise<void> => {
		const id = `${l(projectId)}:${l(userId)}`
		await db.send(
			new PutItemCommand({
				TableName,
				Item: {
					id: {
						S: id,
					},
					type: {
						S: 'projectMember',
					},
					projectMember__project: {
						S: l(projectId),
					},
					projectMember__user: {
						S: l(userId),
					},
					role: {
						S: role,
					},
				},
			}),
		)
		const event: ProjectMemberCreatedEvent = {
			type: CoreEventType.PROJECT_MEMBER_CREATED,
			id,
			project: projectId,
			user: userId,
			role,
			timestamp: new Date(),
		}
		await notify(event)
	}
