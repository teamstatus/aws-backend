import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { Reaction } from './createReaction'

export const getStatusReactions =
	({ db, TableName }: { db: DynamoDBClient; TableName: string }) =>
	async (statusId: string): Promise<Reaction[]> =>
		db
			.send(
				new QueryCommand({
					TableName,
					IndexName: 'statusReaction',
					KeyConditionExpression: '#status = :status',
					ExpressionAttributeNames: {
						'#status': 'statusReaction__status',
					},
					ExpressionAttributeValues: {
						':status': {
							S: statusId,
						},
					},
				}),
			)
			.then(
				({ Items }) =>
					Items?.map((i) => {
						const item = unmarshall(i)
						return {
							id: item.id,
							emoji: item.emoji,
							description: item.description,
							role: item.role,
							author: item.author,
							status: item.statusReaction__status,
						}
					}) ?? [],
			)
