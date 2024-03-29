import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import { Role } from '../Role.js'
import { isOrganizationId, isUserId } from '../ids.js'
import type { DbContext } from './DbContext.js'
import { l } from './l.js'
import { organizationMemberIndex } from './db.js'

export const getOrganizationMember =
	({ db, TableName }: DbContext) =>
	async (
		organizationId: string,
		userId: string,
	): Promise<
		| { error: ProblemDetail }
		| null
		| {
				role: Role
				organization: string
				user: string
		  }
	> => {
		if (!isUserId(userId)) {
			return {
				error: BadRequestError(`Not a valid user ID: ${userId}`),
			}
		}
		const userIdKey = l(userId)
		if (!isOrganizationId(organizationId)) {
			return {
				error: BadRequestError(
					`Not a valid organization ID: ${organizationId}`,
				),
			}
		}
		const organizationIdKey = l(organizationId)

		const res = await db.send(
			new QueryCommand({
				TableName,
				IndexName: organizationMemberIndex,
				KeyConditionExpression:
					'#user = :user AND #organization = :organization',
				ExpressionAttributeNames: {
					'#user': 'organizationMember__user',
					'#organization': 'organizationMember__organization',
				},
				ExpressionAttributeValues: {
					':user': {
						S: userIdKey,
					},
					':organization': {
						S: organizationIdKey,
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
			organization: info.organizationMember__organization,
			user: info.organizationMember__user,
		}
	}

export const isOrganizationMember =
	(dbContext: DbContext) =>
	async (organizationId: string, userId: string): Promise<boolean> =>
		(await getOrganizationMember(dbContext)(organizationId, userId)) !== null

export const isOrganizationOwner =
	(dbContext: DbContext) =>
	async (organizationId: string, userId: string): Promise<boolean> => {
		const member = await getOrganizationMember(dbContext)(
			organizationId,
			userId,
		)
		return member !== null && 'role' in member && member.role === Role.OWNER
	}
