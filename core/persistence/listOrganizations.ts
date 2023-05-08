import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { l, type AuthContext, type DbContext } from '../core'
import type { PersistedOrganization } from './createOrganization'

export const listOrganizations =
	(dbContext: DbContext) =>
	async ({
		userId,
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
		return {
			organizations: await Promise.all(
				(res.Items ?? []).map((item) => {
					const d: {
						organizationMember__organization: string // '$acme',
						id: string // '01GZQ0QH3BQF9W3JQXTDHGB251',
						organizationMember__user: string //'@alex'
					} = unmarshall(item) as any
					return {
						id: d.organizationMember__organization,
					}
				}),
			),
		}
	}
