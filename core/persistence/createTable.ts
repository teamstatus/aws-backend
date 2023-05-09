import {
	BillingMode,
	CreateTableCommand,
	DynamoDBClient,
	KeyType,
	ProjectionType,
	ScalarAttributeType,
	UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb'

export const createTable = async (db: DynamoDBClient, table: string) => {
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
				{
					AttributeName: 'id',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'type',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'organizationMember__organization',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'organizationMember__user',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'projectMember__project',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'projectMember__user',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'projectStatus__project',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'statusReaction__status',
					AttributeType: ScalarAttributeType.S,
				},
			],
			BillingMode: BillingMode.PAY_PER_REQUEST,
			GlobalSecondaryIndexes: [
				{
					IndexName: 'organizationMember',
					KeySchema: [
						{
							AttributeName: 'organizationMember__user',
							KeyType: KeyType.HASH,
						},
						{
							AttributeName: 'organizationMember__organization',
							KeyType: KeyType.RANGE,
						},
					],
					Projection: {
						ProjectionType: ProjectionType.INCLUDE,
						NonKeyAttributes: ['role', 'id'],
					},
				},
				{
					IndexName: 'projectMember',
					KeySchema: [
						{
							AttributeName: 'projectMember__user',
							KeyType: KeyType.HASH,
						},
						{
							AttributeName: 'projectMember__project',
							KeyType: KeyType.RANGE,
						},
					],
					Projection: {
						ProjectionType: ProjectionType.INCLUDE,
						NonKeyAttributes: ['role', 'id'],
					},
				},
				{
					IndexName: 'projectStatus',
					KeySchema: [
						{
							AttributeName: 'projectStatus__project',
							KeyType: KeyType.HASH,
						},
						{
							AttributeName: 'id',
							KeyType: KeyType.RANGE,
						},
					],
					Projection: {
						ProjectionType: ProjectionType.INCLUDE,
						NonKeyAttributes: ['author', 'message', 'version', 'deletedAt'],
					},
				},
				{
					IndexName: 'statusReaction',
					KeySchema: [
						{
							AttributeName: 'statusReaction__status',
							KeyType: KeyType.HASH,
						},
						{
							AttributeName: 'id',
							KeyType: KeyType.RANGE,
						},
					],
					Projection: {
						ProjectionType: ProjectionType.INCLUDE,
						NonKeyAttributes: ['author', 'emoji', 'role', 'description'],
					},
				},
			],
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
