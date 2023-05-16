import {
	App,
	CfnOutput,
	aws_dynamodb as DynamoDB,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { indexes } from '../core/persistence/createTable.js'

class TeamStatusBackendApp extends App {
	constructor({ context }: { context: Record<string, string> }) {
		super({ context })

		const stackPrefix = this.node.tryGetContext('stackNamePrefix') ?? '-backend'
		new TeamStatusBackendStack(this, `${stackPrefix}-backend`)
	}
}

class TeamStatusBackendStack extends Stack {
	constructor(parent: Construct, name: string) {
		super(parent, name)

		const isTest = this.node.tryGetContext('isTest') === '1'

		const persistence = new Persistence(this, { isTest })

		new CfnOutput(this, 'tableName', {
			exportName: `${this.stackName}:tableName`,
			description: 'The name of the table',
			value: persistence.table.tableName,
		})
	}
}

class Persistence extends Construct {
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

new TeamStatusBackendApp({
	context: {
		isTest: process.env.CI !== undefined ? '1' : '0',
		stackNamePrefix: process.env.STACK_NAME_PREFIX ?? 'teamstatus',
	},
})
