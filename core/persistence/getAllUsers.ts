import { AttributeValue, ScanCommand } from '@aws-sdk/client-dynamodb'
import type { User } from './createUser'
import { itemToUser } from './getUser'
import type { DbContext } from './DbContext'

export const getAllUsers =
	({ db, TableName }: DbContext) =>
	async (
		items: User[] = [],
		startKey?: Record<string, AttributeValue>,
	): Promise<User[]> => {
		const { Items, LastEvaluatedKey } = await db.send(
			new ScanCommand({
				TableName,
				FilterExpression: '#type = :user',
				ExclusiveStartKey: startKey,
				ExpressionAttributeNames: {
					'#type': 'type',
				},
				ExpressionAttributeValues: {
					':user': {
						S: 'user',
					},
				},
			}),
		)
		const newItems = [
			...items,
			...(Items ?? []).map((item) => itemToUser(item)),
		]
		if (LastEvaluatedKey === undefined) return newItems
		return getAllUsers({ db, TableName })(newItems, LastEvaluatedKey)
	}
