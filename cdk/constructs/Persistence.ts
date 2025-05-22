import { aws_dynamodb as dynamoDb, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { indexes } from '../../core/persistence/db.ts'
import { isTest } from '@bifravst/aws-cdk-lambda-helpers/util'

export class Persistence extends Construct {
	public readonly table: dynamoDb.Table

	constructor(parent: Construct) {
		super(parent, 'Persistence')

		this.table = new dynamoDb.Table(this, 'coreTable', {
			billingMode: dynamoDb.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'id',
				type: dynamoDb.AttributeType.STRING,
			},
			sortKey: {
				name: 'type',
				type: dynamoDb.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: isTest(this)
				? RemovalPolicy.DESTROY
				: RemovalPolicy.RETAIN,
			pointInTimeRecoverySpecification: {
				pointInTimeRecoveryEnabled: !isTest(this),
			},
		})

		Object.entries(indexes).map(([indexName, { keys, include }]) =>
			this.table.addGlobalSecondaryIndex({
				indexName,
				partitionKey: {
					name: keys[0],
					type: dynamoDb.AttributeType.STRING,
				},
				sortKey: {
					name: keys[1],
					type: dynamoDb.AttributeType.STRING,
				},
				projectionType:
					include === undefined
						? dynamoDb.ProjectionType.KEYS_ONLY
						: dynamoDb.ProjectionType.INCLUDE,
				nonKeyAttributes: include,
			}),
		)
	}
}
