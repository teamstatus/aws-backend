import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { type NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb'
import { chunkArray } from '../../util/chunkArray.ts'
import type { UserAuthContext } from '../auth.ts'
import type { ProblemDetail } from '../ProblemDetail.ts'
import type { Organization } from './createOrganization.ts'
import type { DbContext } from './DbContext.ts'
import { organizationMemberIndex } from './db.ts'
import { l } from './l.ts'

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

		const organizations = (
			await Promise.all(
				chunkArray(Items, 100).map(async (chunk) => {
					const { Responses } = await db.send(
						new BatchGetItemCommand({
							RequestItems: {
								[TableName]: {
									Keys: chunk
										.map((Item) => unmarshall(Item))
										.map(({ organizationMember__organization: id }) => ({
											id: { S: id },
											type: {
												S: 'organization',
											},
										})),
								},
							},
						}),
					)
					return (Responses?.[TableName] ?? []).map((Item) =>
						itemToOrganization(unmarshall(Item)),
					)
				}),
			)
		).flat()

		return {
			organizations,
		}
	}

const itemToOrganization = (
	item: Record<string, NativeAttributeValue>,
): Organization => ({
	id: item.id,
	name: item.name,
})
