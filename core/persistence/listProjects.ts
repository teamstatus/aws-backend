import { GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import type { Project } from './createProject.js'
import { isOrganizationMember } from './getOrganizationMember.js'
import { l } from './l.js'

export const listProjects =
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

		const { db, table } = dbContext
		const res = await db.send(
			new QueryCommand({
				TableName: table,
				IndexName: 'projectMember',
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

		const projects: Project[] = []

		for (const membership of res.Items ?? []) {
			const d: {
				projectMember__project: string // '#teamstatus',
			} = unmarshall(membership) as any
			const project = await getProject(dbContext)(d.projectMember__project)
			if (project !== null) projects.push(project)
		}

		return {
			projects,
		}
	}

const getProject =
	({ db, table }: DbContext) =>
	async (projectId: string): Promise<Project | null> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName: table,
				Key: {
					id: {
						S: projectId,
					},
					type: {
						S: 'project',
					},
				},
			}),
		)

		if (Item === undefined) return null
		const project = unmarshall(Item)

		return {
			id: projectId,
			name: project.name,
			color: project.color,
		}
	}
