import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { chunkArray } from '../../util/chunkArray.ts'
import type { UserAuthContext } from '../auth.ts'
import type { ProblemDetail } from '../ProblemDetail.ts'
import type { Role } from '../Role.ts'
import type { Project } from './createProject.ts'
import type { DbContext } from './DbContext.ts'
import { projectMemberIndex } from './db.ts'
import { itemToProject } from './getProject.ts'
import { l } from './l.ts'

export type UserProject = Project & { role: Role }

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
				IndexName: projectMemberIndex,
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

		if (Items === undefined || Items.length === 0) {
			return { projects: [] }
		}

		const projectRole: Record<string, Role> = Items.map((Item) =>
			unmarshall(Item),
		).reduce(
			(projectRole, { projectMember__project, role }) => ({
				...projectRole,
				[projectMember__project]: role,
			}),
			{},
		)

		const projects = (
			await Promise.all(
				chunkArray(Items, 100).map(async (chunk) => {
					const { Responses } = await db.send(
						new BatchGetItemCommand({
							RequestItems: {
								[TableName]: {
									Keys: chunk
										.map((Item) => unmarshall(Item))
										.map(({ projectMember__project: id }) => ({
											id: { S: id },
											type: {
												S: 'project',
											},
										})),
								},
							},
						}),
					)

					return (Responses?.[TableName] ?? []).map((Item) => {
						const project = itemToProject(unmarshall(Item))
						return {
							...project,
							role: projectRole[project.id],
						} as UserProject
					})
				}),
			)
		).flat()

		return {
			projects,
		}
	}
