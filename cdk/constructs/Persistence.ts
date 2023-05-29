import { aws_dynamodb as DynamoDB, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { indexes } from '../../core/persistence/db.js'

export class Persistence extends Construct {
	public readonly table: DynamoDB.Table

	constructor(parent: Construct, { isTest }: { isTest: boolean }) {
		super(parent, 'Persistence')

		this.table = new DynamoDB.Table(this, 'coreTable', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'id',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'type',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: isTest ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
			pointInTimeRecovery: !isTest,
		})

		Object.entries(indexes).map(([indexName, { keys, include }]) =>
			this.table.addGlobalSecondaryIndex({
				indexName,
				partitionKey: {
					name: keys[0],
					type: DynamoDB.AttributeType.STRING,
				},
				sortKey: {
					name: keys[1],
					type: DynamoDB.AttributeType.STRING,
				},
				projectionType:
					include === undefined
						? DynamoDB.ProjectionType.KEYS_ONLY
						: DynamoDB.ProjectionType.INCLUDE,
				nonKeyAttributes: include,
			}),
		)
	}
}
