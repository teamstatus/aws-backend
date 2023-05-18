import { GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { VerifyTokenUserFn } from '../token.js'
import { type DbContext } from './DbContext.js'
import type { PersistedOrganization } from './createOrganization'
import { l } from './l.js'

export const listOrganizations =
	(verifyToken: VerifyTokenUserFn, dbContext: DbContext) =>
	async (
		token: string,
	): Promise<{ error: Error } | { organizations: PersistedOrganization[] }> => {
		const { sub: userId } = verifyToken(token)
		const { db, table } = dbContext
		const res = await db.send(
			new QueryCommand({
				TableName: table,
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
		const organizations: PersistedOrganization[] = []

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
	({ db, table }: DbContext) =>
	async (organizationId: string): Promise<PersistedOrganization | null> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName: table,
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
