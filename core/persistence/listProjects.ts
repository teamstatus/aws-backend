import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { ProblemDetail } from '../ProblemDetail.js'
import type { Role } from '../Role.js'
import type { UserAuthContext } from '../auth.js'
import type { DbContext } from './DbContext.js'
import type { Project } from './createProject.js'
import { itemToProject } from './getProject.js'
import { l } from './l.js'

type UserProject = Project & { role: Role }

export const listProjects =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { projects: UserProject[] }> => {
		const { sub: userId } = authContext

		const { db, TableName } = dbContext
		const { Items } = await db.send(
			new QueryCommand({
				TableName,
				IndexName: 'projectMember',
				KeyConditionExpression: '#user = :user',
				ExpressionAttributeNames: {
					'#user': 'projectMember__user',
					'#project': 'projectMember__project',
					'#role': 'role',
					'#version': 'version',
				},
				ExpressionAttributeValues: {
					':user': {
						S: l(userId),
					},
				},
				ProjectionExpression: '#user, #role, #project, #version',
			}),
		)

		if (Items === undefined || Items.length === 0) return { projects: [] }

		const projectRole: Record<string, Role> = Items.map((Item) =>
			unmarshall(Item),
		).reduce(
			(projectRole, { projectMember__project, role }) => ({
				...projectRole,
				[projectMember__project]: role,
			}),
			{},
		)

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
			projects: (Responses?.[TableName] ?? []).map((Item) => {
				const project = itemToProject(unmarshall(Item))
				return {
					...project,
					role: projectRole[project.id],
				} as UserProject
			}),
		}
	}
