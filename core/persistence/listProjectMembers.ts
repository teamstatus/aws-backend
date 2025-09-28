import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { UserAuthContext } from '../auth.ts'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.ts'
import type { ProjectMember } from './createProjectMember.ts'
import type { DbContext } from './DbContext.ts'
import { projectMembersIndex } from './db.ts'
import { canUpdateProject } from './getProjectMember.ts'
import { l } from './l.ts'

export const listProjectMembers =
	(dbContext: DbContext) =>
	async (
		projectId: string,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { members: ProjectMember[] }> => {
		const { sub: userId } = authContext
		if (!(await canUpdateProject(dbContext)(projectId, userId))) {
			return {
				error: BadRequestError(
					`Only administrators of ${projectId} can view members.`,
				),
			}
		}

		const { db, TableName } = dbContext
		const { Items } = await db.send(
			new QueryCommand({
				TableName,
				IndexName: projectMembersIndex,
				KeyConditionExpression: '#project = :project',
				ExpressionAttributeNames: {
					'#project': 'projectMember__project',
				},
				ExpressionAttributeValues: {
					':project': {
						S: l(projectId),
					},
				},
			}),
		)

		if (Items === undefined || Items.length === 0) {
			return { members: [] }
		}

		return {
			members: Items.map((Item) => {
				const item = unmarshall(Item)
				return <ProjectMember>{
					id: item.id,
					project: projectId,
					role: item.role,
					user: item.projectMember__user,
				}
			}),
		}
	}
