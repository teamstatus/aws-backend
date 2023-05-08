import { GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { l, type AuthContext, type DbContext } from '../core'
import type { PersistedProject } from './createProject'
import { isOrganizationMember } from './getOrganizationMember'

export const listProjects =
	(dbContext: DbContext) =>
	async (
		organizationId: string,
		{ userId }: AuthContext,
	): Promise<{ error: Error } | { projects: PersistedProject[] }> => {
		if (!(await isOrganizationMember(dbContext)(organizationId, userId))) {
			return {
				error: new Error(
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

		const projects: PersistedProject[] = []

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
	async (projectId: string): Promise<PersistedProject | null> => {
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
		}
	}
