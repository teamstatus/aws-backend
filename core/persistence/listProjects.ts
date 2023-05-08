import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Role, l, type AuthContext, type DbContext } from '../core'
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
		return {
			projects: await Promise.all(
				(res.Items ?? []).map((item) => {
					const d: {
						projectMember__project: string // '#teamstatus',
						role: Role.OWNER
						id: string // '01GZQ0QH3BQF9W3JQXTDHGB251',
						projectMember__user: string //'@alex'
					} = unmarshall(item) as any
					return {
						id: d.projectMember__project,
					}
				}),
			),
		}
	}
