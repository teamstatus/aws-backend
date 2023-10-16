import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { DbContext } from './DbContext.js'
import type { Organization } from './createOrganization'
import { l } from './l.js'
import { organizationMemberIndex } from './db.js'

export const listOrganizations =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { organizations: Organization[] }> => {
		const { sub: userId } = authContext
		const { db, TableName } = dbContext
		const { Items } = await db.send(
			new QueryCommand({
				TableName,
				IndexName: organizationMemberIndex,
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

		if (Items === undefined || Items.length === 0) return { organizations: [] }

		const { Responses } = await db.send(
			new BatchGetItemCommand({
				RequestItems: {
					[TableName]: {
						Keys: Items.map((Item) => unmarshall(Item)).map(
							({ organizationMember__organization: id }) => ({
								id: { S: id },
								type: {
									S: 'organization',
								},
							}),
						),
					},
				},
			}),
		)

		return {
			organizations: (Responses?.[TableName] ?? []).map((Item) =>
				itemToOrganization(unmarshall(Item)),
			),
		}
	}

const itemToOrganization = (item: Record<string, any>): Organization => ({
	id: item.id,
	name: item.name,
})
