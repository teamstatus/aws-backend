import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import {
	CoreEventType,
	Role,
	l,
	type AuthContext,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core.js'
import { parseProjectId } from '../ids.js'
import { createProjectMember } from './createProjectMember.js'
import { isOrganizationMember } from './getOrganizationMember.js'
export type ProjectCreatedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_CREATED
	id: string
	owner: string
}
export type PersistedProject = { id: string }
export const createProject =
	(dbContext: DbContext, notify: Notify) =>
	async (
		projectId: string,
		{ userId }: AuthContext,
	): Promise<{ error: Error } | { project: PersistedProject }> => {
		const { organization: organizationId } = parseProjectId(projectId)

		if (organizationId === null) {
			return {
				error: new Error(`Not a valid project ID: ${projectId}`),
			}
		}

		if (!(await isOrganizationMember(dbContext)(organizationId, userId))) {
			return {
				error: new Error(
					`Only members of ${organizationId} can create new projects.`,
				),
			}
		}
		try {
			const { db, table } = dbContext
			await db.send(
				new PutItemCommand({
					TableName: table,
					Item: {
						id: {
							S: l(projectId),
						},
						type: {
							S: 'project',
						},
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			const event: ProjectCreatedEvent = {
				type: CoreEventType.PROJECT_CREATED,
				id: projectId,
				owner: userId,
			}
			notify(event)

			await createProjectMember(dbContext, notify)(
				projectId,
				userId,
				Role.OWNER,
			)

			return {
				project: {
					id: projectId,
				},
			}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: new Error(`Project '${projectId}' already exists.`),
				}
			return { error: error as Error }
		}
	}
