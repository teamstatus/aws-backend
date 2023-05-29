import { GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import type { Organization } from './createOrganization'
import { l } from './l.js'

export const listOrganizations =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { organizations: Organization[] }> => {
		const { sub: userId } = authContext
		const { db, TableName } = dbContext
		const res = await db.send(
			new QueryCommand({
				TableName,
				IndexName: 'organizationMember',
				KeyConditionExpression: '#user = :user',
				ExpressionAttributeNames: {
					'#user': 'organizationMember__user',
				},
				ExpressionAttributeValues: {
					':user': {
						S: l(userId),
					},
				},
			}),
		)
		const organizations: Organization[] = []

		for (const item of res.Items ?? []) {
			const d = unmarshall(item)
			const org = await getOrganization(dbContext)(
				d.organizationMember__organization,
			)
			if (org !== null) organizations.push(org)
		}
		return {
			organizations,
		}
	}

const getOrganization =
	({ db, TableName }: DbContext) =>
	async (organizationId: string): Promise<Organization | null> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: organizationId,
					},
					type: {
						S: 'organization',
					},
				},
			}),
		)

		if (Item === undefined) return null
		const org = unmarshall(Item)

		return {
			id: organizationId,
			name: org.name,
		}
	}
