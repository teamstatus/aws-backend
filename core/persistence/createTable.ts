import {
	BillingMode,
	CreateTableCommand,
	DynamoDBClient,
	KeyType,
	ProjectionType,
	ScalarAttributeType,
	UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb'

export const indexes: Record<
	string,
	{ keys: [hash: string, range: string]; include?: string[] }
> = {
	organizationMember: {
		keys: ['organizationMember__user', 'organizationMember__organization'],
		include: ['role', 'id'],
	},
	projectMember: {
		keys: ['projectMember__user', 'projectMember__project'],
		include: ['role', 'id'],
	},
	projectStatus: {
		keys: ['projectStatus__project', 'id'],
		include: ['author', 'message', 'version'],
	},
	statusReaction: {
		keys: ['statusReaction__status', 'id'],
		include: ['author', 'emoji', 'role', 'description'],
	},
	emailUser: {
		keys: ['user__email', 'id'],
	},
}

export const createTable = async (
	db: DynamoDBClient,
	table: string,
): Promise<void> => {
	await db.send(
		new CreateTableCommand({
			TableName: table,
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
					...Object.values(indexes)
						.map(({ keys }) => keys)
						.flat(),
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
			TableName: table,
			TimeToLiveSpecification: {
				Enabled: true,
				AttributeName: 'ttl',
			},
		}),
	)
}
