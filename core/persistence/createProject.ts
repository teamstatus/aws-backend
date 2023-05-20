import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	BadRequestError,
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import { Role } from '../Role.js'
import type { UserAuthContext } from '../auth.js'
import { parseProjectId } from '../ids.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
import { createProjectMember } from './createProjectMember.js'
import { isOrganizationMember } from './getOrganizationMember.js'
import { l } from './l.js'
export type ProjectCreatedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_CREATED
} & PersistedProject
export type PersistedProject = {
	id: string
	name: string | null
	color: string | null
}
export const createProject =
	(dbContext: DbContext, notify: Notify) =>
	async (
		{
			id: projectId,
			name,
			color,
		}: { id: string; name?: string; color?: string },
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { project: PersistedProject }> => {
		const { sub: userId } = authContext
		const { organization: organizationId } = parseProjectId(projectId)

		if (organizationId === null) {
			return {
				error: BadRequestError(`Not a valid project ID: ${projectId}`),
			}
		}

		if (!(await isOrganizationMember(dbContext)(organizationId, userId))) {
			return {
				error: BadRequestError(
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
						name:
							name !== undefined
								? {
										S: name,
								  }
								: { NULL: true },
						color:
							color !== undefined
								? {
										S: color,
								  }
								: { NULL: true },
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			const event: ProjectCreatedEvent = {
				type: CoreEventType.PROJECT_CREATED,
				id: projectId,
				name: name ?? null,
				color: color ?? null,
				timestamp: new Date(),
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
					name: name ?? null,
					color: color ?? null,
				},
			}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Project '${projectId}' already exists.`),
				}
			console.error((error as Error).message)
			return { error: InternalError() }
		}
	}
