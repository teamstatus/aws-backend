import {
	BillingMode,
	CreateTableCommand,
	DynamoDBClient,
	KeyType,
	ProjectionType,
	ScalarAttributeType,
	UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb'
import { indexes } from '../db.js'

export const createTable = async (
	db: DynamoDBClient,
	TableName: string,
): Promise<void> => {
	await db.send(
		new CreateTableCommand({
			TableName,
			KeySchema: [
				{
					AttributeName: 'id',
					KeyType: KeyType.HASH,
				},
				{
					AttributeName: 'type',
					KeyType: KeyType.RANGE,
				},
			],
			AttributeDefinitions: [
				...new Set([
					'id',
					'type',
					...Object.values(indexes).flatMap(({ keys }) => keys),
				]),
			].map((AttributeName) => ({
				AttributeName,
				AttributeType: ScalarAttributeType.S,
			})),
			BillingMode: BillingMode.PAY_PER_REQUEST,
			GlobalSecondaryIndexes: Object.entries(indexes).map(
				([IndexName, { keys, include }]) => ({
					IndexName,
					KeySchema: [
						{
							AttributeName: keys[0],
							KeyType: KeyType.HASH,
						},
						{
							AttributeName: keys[1],
							KeyType: KeyType.RANGE,
						},
					],
					Projection:
						include === undefined
							? {
									ProjectionType: ProjectionType.KEYS_ONLY,
							  }
							: {
									ProjectionType: ProjectionType.INCLUDE,
									NonKeyAttributes: include,
							  },
				}),
			),
		}),
	)
	await db.send(
		new UpdateTimeToLiveCommand({
			TableName,
			TimeToLiveSpecification: {
				Enabled: true,
				AttributeName: 'ttl',
			},
		}),
	)
}
