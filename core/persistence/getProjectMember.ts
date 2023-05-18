import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Role } from '../Role.js'
import { type DbContext } from './DbContext.js'
import { l } from './l.js'

type MemberInfo = {
	role: Role
	project: string
	user: string
}
export const getProjectMember =
	(dbContext: DbContext) =>
	async (
		projectId: string,
		userId: string,
	): Promise<{ error: Error } | null | MemberInfo> => {
		const { db, table } = dbContext
		const res = await db.send(
			new QueryCommand({
				TableName: table,
				IndexName: 'projectMember',
				KeyConditionExpression: '#user = :user AND #project = :project',
				ExpressionAttributeNames: {
					'#user': 'projectMember__user',
					'#project': 'projectMember__project',
				},
				ExpressionAttributeValues: {
					':user': {
						S: l(userId),
					},
					':project': {
						S: l(projectId),
					},
				},
				Limit: 1,
			}),
		)

		const memberInfo = res.Items?.[0]
		if (memberInfo === undefined) return null
		const info = unmarshall(memberInfo)
		return {
			role: info.role,
			project: info.projectMember__projectMember,
			user: info.projectMember__user,
		}
	}

export const isProjectMember =
	(dbContext: DbContext) =>
	async (projectId: string, userId: string): Promise<boolean> =>
		(await getProjectMember(dbContext)(projectId, userId)) !== null
