import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import type { Sync } from './createSync.js'
import { itemToSync } from './getSync.js'
import { l } from './l.js'

export const listSyncs =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { syncs: Sync[] }> => {
		const { sub: userId } = authContext

		const { db, TableName } = dbContext
		const res = await db.send(
			new QueryCommand({
				TableName,
				IndexName: 'syncOwner',
				KeyConditionExpression: '#owner = :user',
				ExpressionAttributeNames: {
					'#id': 'id',
					'#owner': 'sync__owner',
				},
				ExpressionAttributeValues: {
					':user': {
						S: l(userId),
					},
				},
				ProjectionExpression: '#id',
			}),
		)

		const items = res.Items ?? []

		if (items.length === 0)
			return {
				syncs: [],
			}

		const { Responses } = await db.send(
			new BatchGetItemCommand({
				RequestItems: {
					[TableName]: {
						Keys: items
							.map((Item) => unmarshall(Item))
							.map(({ id }) => ({
								id: { S: id },
								type: {
									S: 'projectSync',
								},
							})),
					},
				},
			}),
		)

		return {
			syncs: (Responses?.[TableName] ?? []).map((Item) =>
				itemToSync(unmarshall(Item)),
			),
		}
	}
