import { GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { l, type AuthContext, type DbContext } from '../core.js'
import type { PersistedOrganization } from './createOrganization'

export const listOrganizations =
	(dbContext: DbContext) =>
	async ({
		sub: userId,
	}: AuthContext): Promise<
		{ error: Error } | { organizations: PersistedOrganization[] }
	> => {
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
