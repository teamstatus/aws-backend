import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { Reaction, StatusReaction } from './createReaction.js'
import { statusReactionIndex } from './db.js'

export const getStatusReactions =
	({ db, TableName }: { db: DynamoDBClient; TableName: string }) =>
	async (statusId: string): Promise<Reaction[]> =>
		db
			.send(
				new QueryCommand({
					TableName,
					IndexName: statusReactionIndex,
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
						const reaction: StatusReaction & { role?: string } = {
							id: item.id,
							emoji: item.emoji,
							author: item.author,
							status: item.statusReaction__status,
						}
						if (item.description !== null)
							reaction.description = item.description
						if (item.role !== null) reaction.role = item.role
						return reaction
					}) ?? [],
			)
