import {
	BillingMode,
	CreateTableCommand,
	DynamoDBClient,
	KeyType,
	ProjectionType,
	ScalarAttributeType,
} from '@aws-sdk/client-dynamodb'

export const createTable = async (db: DynamoDBClient, table: string) =>
	db.send(
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
					AttributeName: 'status__project',
					AttributeType: ScalarAttributeType.S,
				},
				{
					AttributeName: 'status__author',
					AttributeType: ScalarAttributeType.S,
				},
			],
			BillingMode: BillingMode.PAY_PER_REQUEST,
			GlobalSecondaryIndexes: [
				{
					IndexName: 'memberOrganizations',
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
					IndexName: 'memberProjects',
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
							AttributeName: 'status__project',
							KeyType: KeyType.HASH,
						},
						{
							AttributeName: 'id',
							KeyType: KeyType.RANGE,
						},
					],
					Projection: {
						ProjectionType: ProjectionType.INCLUDE,
						NonKeyAttributes: ['status__author', 'status__message'],
					},
				},
			],
		}),
	)
