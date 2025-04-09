import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { ProblemDetail } from '../ProblemDetail.ts'
import type { UserAuthContext } from '../auth.ts'
import type { DbContext } from './DbContext.ts'
import type { Organization } from './createOrganization.ts'
import { l } from './l.ts'
import { organizationMemberIndex } from './db.ts'

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

		if (Items === undefined || Items.length === 0) {
			return { organizations: [] }
		}

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
