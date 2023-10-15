import {
	ConditionalCheckFailedException,
	DeleteItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	BadRequestError,
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import type { DbContext } from './DbContext.js'
import { canUpdateProject } from './getProjectMember.js'

type ProjectDeletedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_DELETED
	id: string
}

export const deleteProject =
	(dbContext: DbContext, notify: Notify) =>
	async (
		id: string,
		version: number,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { deleted: true }> => {
		try {
			const { sub: userId } = authContext

			if (!(await canUpdateProject(dbContext)(id, userId))) {
				return {
					error: BadRequestError(`Your are not allowed to update ${id}.`),
				}
			}

			const { db, TableName } = dbContext
			await db.send(
				new DeleteItemCommand({
					TableName,
					Key: {
						id: {
							S: id,
						},
						type: {
							S: 'project',
						},
					},
					ConditionExpression: '#version = :version',
					ExpressionAttributeNames: {
						'#version': 'version',
					},
					ExpressionAttributeValues: {
						':version': {
							N: `${version}`,
						},
					},
				}),
			)
			const event: ProjectDeletedEvent = {
				type: CoreEventType.PROJECT_DELETED,
				id,
				timestamp: new Date(),
			}
			await notify(event)
			return { deleted: true }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Failed to delete project.`),
				}
			console.error(error)
			return { error: InternalError() }
		}
	}
