import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Role, l, type DbContext } from '../core.js'
import { isOrganizationId, isUserId } from '../ids.js'

export const getOrganizationMember =
	({ db, table }: DbContext) =>
	async (
		organizationId: string,
		userId: string,
	): Promise<
		| { error: Error }
		| null
		| {
				role: Role
				organization: string
				user: string
		  }
	> => {
		if (!isUserId(userId)) {
			return {
				error: new Error(`Not a valid user ID: ${userId}`),
			}
		}
		const userIdKey = l(userId)
		if (!isOrganizationId(organizationId)) {
			return {
				error: new Error(`Not a valid organization ID: ${organizationId}`),
			}
		}
		const organizationIdKey = l(organizationId)

		const res = await db.send(
			new QueryCommand({
				TableName: table,
				IndexName: 'organizationMember',
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
	(dbContext: DbContext) => async (organizationId: string, userId: string) =>
		(await getOrganizationMember(dbContext)(organizationId, userId)) !== null

export const isOrganizationOwner =
	(dbContext: DbContext) => async (organizationId: string, userId: string) => {
		const member = await getOrganizationMember(dbContext)(
			organizationId,
			userId,
		)
		return member !== null && 'role' in member && member.role === Role.OWNER
	}
