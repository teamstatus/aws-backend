import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { DbContext } from './DbContext.js'
import type { Project } from './createProject.js'
import { isOrganizationMember } from './getOrganizationMember.js'
import { itemToProject } from './getProject.js'
import { l } from './l.js'
import { projectMemberIndex } from './db.js'

export const listOrganizationProjects =
	(dbContext: DbContext) =>
	async (
		organizationId: string,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { projects: Project[] }> => {
		const { sub: userId } = authContext
		if (!(await isOrganizationMember(dbContext)(organizationId, userId))) {
			return {
				error: BadRequestError(
					`Only members of ${organizationId} can view projects.`,
				),
			}
		}

		const { db, TableName } = dbContext
		const { Items } = await db.send(
			new QueryCommand({
				TableName,
				IndexName: projectMemberIndex,
				KeyConditionExpression: '#user = :user',
				ExpressionAttributeNames: {
					'#user': 'projectMember__user',
				},
				ExpressionAttributeValues: {
					':user': {
						S: l(userId),
					},
				},
			}),
		)

		if (Items === undefined || Items.length === 0) return { projects: [] }

		const { Responses } = await db.send(
			new BatchGetItemCommand({
				RequestItems: {
					[TableName]: {
						Keys: Items.map((Item) => unmarshall(Item)).map(
							({ projectMember__project: id }) => ({
								id: { S: id },
								type: {
									S: 'project',
								},
							}),
						),
					},
				},
			}),
		)

		return {
			projects: (Responses?.[TableName] ?? []).map((Item) =>
				itemToProject(unmarshall(Item)),
			),
		}
	}
