import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
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
import type { Project } from './createProject.js'
import { unmarshall } from '@aws-sdk/util-dynamodb'

export type ProjectUpdatedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_UPDATED
	version: number
} & Project

export const updateProject =
	(dbContext: DbContext, notify: Notify) =>
	async (
		id: string,
		update: Pick<Project, 'name'>,
		version: number,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		try {
			const { sub: userId } = authContext

			if (!(await canUpdateProject(dbContext)(id, userId))) {
				return {
					error: BadRequestError(`Your are not allowed to update ${id}.`),
				}
			}

			const { db, TableName } = dbContext
			const { Attributes } = await db.send(
				new UpdateItemCommand({
					TableName,
					Key: {
						id: {
							S: id,
						},
						type: {
							S: 'project',
						},
					},
					UpdateExpression: 'SET #name = :name, #version = :newVersion',
					ConditionExpression: '#version = :version',
					ExpressionAttributeNames: {
						'#name': 'name',
						'#version': 'version',
					},
					ExpressionAttributeValues: {
						':name':
							update.name !== undefined
								? {
										S: update.name,
								  }
								: { NULL: true },
						':version': {
							N: `${version}`,
						},
						':newVersion': {
							N: `${version + 1}`,
						},
					},
					ReturnValues: 'ALL_NEW',
				}),
			)
			if (Attributes === undefined)
				return { error: ConflictError('Update failed.') }
			const updated = unmarshall(Attributes)
			const event: ProjectUpdatedEvent = {
				type: CoreEventType.PROJECT_UPDATED,
				id,
				name: update.name,
				version: updated.version,
				timestamp: new Date(),
			}
			await notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`Failed to update project.`),
				}
			console.error(error)
			return { error: InternalError() }
		}
	}
