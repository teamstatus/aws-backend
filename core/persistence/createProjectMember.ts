import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import {
	CoreEventType,
	Role,
	l,
	type CoreEvent,
	type DbContext,
} from '../core.js'
import type { Notify } from '../notifier.js'

export type ProjectMemberCreatedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_MEMBER_CREATED
} & PersistedProjectMember

export type PersistedProjectMember = {
	id: string
	project: string
	user: string
	role: Role
}

export const createProjectMember =
	({ db, table }: DbContext, notify: Notify) =>
	async (
		projectId: string,
		userId: string,
		role: Role,
	): Promise<PersistedProjectMember> => {
		const id = `${l(projectId)}:${l(userId)}`
		await db.send(
			new PutItemCommand({
				TableName: table,
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
		const member: PersistedProjectMember = {
			id,
			project: projectId,
			user: userId,
			role,
		}
		notify({
			type: CoreEventType.PROJECT_MEMBER_CREATED,
			...member,
			timestamp: new Date(),
		})
		return member
	}
