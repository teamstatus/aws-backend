import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { ProblemDetail } from '../ProblemDetail.js'
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
	): Promise<{ error: ProblemDetail } | { member: MemberInfo | null }> => {
		const { db, TableName } = dbContext
		const res = await db.send(
			new QueryCommand({
				TableName,
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
		if (memberInfo === undefined) return { member: null }
		const info = unmarshall(memberInfo)
		return {
			member: {
				role: info.role,
				project: info.projectMember__projectMember,
				user: info.projectMember__user,
			},
		}
	}

const getMemberRole =
	(dbContext: DbContext) =>
	async (projectId: string, userId: string): Promise<Role | null> => {
		const maybeMember = await getProjectMember(dbContext)(projectId, userId)
		if ('error' in maybeMember) return null
		const { member } = maybeMember
		return member?.role ?? null
	}

export const canWriteStatus =
	(dbContext: DbContext) =>
	async (projectId: string, userId: string): Promise<boolean> => {
		const role = await getMemberRole(dbContext)(projectId, userId)
		if (role === null) return false
		return [Role.OWNER, Role.MEMBER].includes(role)
	}

export const canWriteReaction =
	(dbContext: DbContext) =>
	async (projectId: string, userId: string): Promise<boolean> => {
		const role = await getMemberRole(dbContext)(projectId, userId)
		if (role === null) return false
		return [Role.OWNER, Role.MEMBER, Role.WATCHER].includes(role)
	}

export const canReadProjectStatus =
	(dbContext: DbContext) =>
	async (projectId: string, userId: string): Promise<boolean> => {
		const role = await getMemberRole(dbContext)(projectId, userId)
		if (role === null) return false
		return [Role.OWNER, Role.MEMBER, Role.WATCHER].includes(role)
	}
