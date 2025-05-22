import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.ts'
import type { UserAuthContext } from '../auth.ts'
import type { DbContext } from './DbContext.ts'
import type { Project } from './createProject.ts'
import { isOrganizationMember } from './getOrganizationMember.ts'
import { itemToProject } from './getProject.ts'
import { l } from './l.ts'
import { projectMemberIndex } from './db.ts'
import { chunkArray } from '../../util/chunkArray.ts'

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

		if (Items === undefined || Items.length === 0) {
			return { projects: [] }
		}

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
											type: { S: 'project' },
										})),
								},
							},
						}),
					)
					return (Responses?.[TableName] ?? []).map((Item) =>
						itemToProject(unmarshall(Item)),
					)
				}),
			)
		).flat()

		return {
			projects,
		}
	}
