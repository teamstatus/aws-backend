import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type ProblemDetail } from '../ProblemDetail.js'
import type { Role } from '../Role.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import type { Project } from './createProject.js'
import { getProject } from './getProject.js'
import { l } from './l.js'

type UserProject = Project & { role: Role }

export const listProjects =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { projects: UserProject[] }> => {
		const { sub: userId } = authContext

		const { db, TableName } = dbContext
		const res = await db.send(
			new QueryCommand({
				TableName,
				IndexName: 'projectMember',
				KeyConditionExpression: '#user = :user',
				ExpressionAttributeNames: {
					'#user': 'projectMember__user',
					'#project': 'projectMember__project',
					'#role': 'role',
				},
				ExpressionAttributeValues: {
					':user': {
						S: l(userId),
					},
				},
				ProjectionExpression: '#user, #role, #project',
			}),
		)

		const projects: UserProject[] = []

		for (const membership of res.Items ?? []) {
			console.log(JSON.stringify({ membership }))
			const d: {
				projectMember__project: string // '#teamstatus',
				role: Role
			} = unmarshall(membership) as any
			const project = await getProject(dbContext)(d.projectMember__project)
			if (project !== null)
				projects.push({
					...project,
					role: d.role,
				})
		}

		return {
			projects,
		}
	}
