import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { CoreEvent } from '../CoreEvent.ts'
import { CoreEventType } from '../CoreEventType.ts'
import {
	BadRequestError,
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import { Role } from '../Role.ts'
import type { UserAuthContext } from '../auth.ts'
import { parseProjectId } from '../ids.ts'
import type { Notify } from '../notifier.ts'
import type { DbContext } from './DbContext.ts'
import { createProjectMember } from './createProjectMember.ts'
import { isOrganizationMember } from './getOrganizationMember.ts'
import { l } from './l.ts'
export type ProjectCreatedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_CREATED
} & Project

export type Project = {
	id: string
	name?: string
	version: number
}
export const createProject =
	(dbContext: DbContext, notify: Notify) =>
	async (
		{ id: projectId, name }: { id: string; name: string },
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
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
			const { db, TableName } = dbContext
			await db.send(
				new PutItemCommand({
					TableName,
					Item: {
						id: {
							S: l(projectId),
						},
						type: {
							S: 'project',
						},
						name:
							name === undefined
								? { NULL: true }
								: {
										S: name,
									},
						version: {
							N: `1`,
						},
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			const event: ProjectCreatedEvent = {
				type: CoreEventType.PROJECT_CREATED,
				id: projectId,
				name,
				timestamp: new Date(),
				version: 1,
			}
			await notify(event)

			await createProjectMember(dbContext, notify)(
				projectId,
				userId,
				Role.OWNER,
			)

			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: ConflictError(`Project '${projectId}' already exists.`),
				}
			}
			return { error: InternalError() }
		}
	}
