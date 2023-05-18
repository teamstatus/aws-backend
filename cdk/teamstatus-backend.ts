import {
	App,
	CfnOutput,
	Duration,
	aws_dynamodb as DynamoDB,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_logs as Logs,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { indexes } from '../core/persistence/createTable.js'
import {
	packBackendLambdas,
	type BackendLambdas,
} from './lambdas/packBackendLambdas.js'
import type { PackedLayer } from './lambdas/packLayer.js'
import { packLayer } from './lambdas/packLayer.js'

class AuthenticationAPI extends Construct {
	public readonly loginRequestURL: Lambda.IFunctionUrl
	constructor(
		parent: Stack,
		{
			lambdaSources,
			persistence,
			layer,
		}: {
			lambdaSources: BackendLambdas
			layer: Lambda.ILayerVersion
			persistence: Persistence
		},
	) {
		super(parent, 'AuthenticationAPI')

		const loginRequest = new Lambda.Function(this, 'loginRequest', {
			description: 'Handle login requests',
			handler: lambdaSources.loginRequest.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.loginRequest.zipFile),
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ses:SendEmail'],
					resources: ['*'],
				}),
				new IAM.PolicyStatement({
					actions: ['ssm:GetParameter'],
					resources: [
						`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${parent.stackName}/privateKey`,
					],
				}),
			],
			environment: {
				STACK_NAME: parent.stackName,
				TABLE_NAME: persistence.table.tableName,
			},
		})
		this.loginRequestURL = loginRequest.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
			cors: {
				allowCredentials: false,
				allowedMethods: [Lambda.HttpMethod.POST],
				maxAge: Duration.seconds(60),
				exposedHeaders: ['Content-Type', 'Content-Length'],
				allowedOrigins: ['http://localhost:8080', 'http://teamstatus.space'],
			},
		})

		persistence.table.grantFullAccess(loginRequest)
	}
}

class TeamStatusBackendApp extends App {
	constructor({
		context,
		lambdaSources,
		layer,
	}: {
		context: Record<string, string>
		lambdaSources: BackendLambdas
		layer: PackedLayer
	}) {
		super({ context })

		const stackPrefix = this.node.tryGetContext('stackNamePrefix') ?? '-backend'
		new TeamStatusBackendStack(this, `${stackPrefix}-backend`, {
			lambdaSources,
			layer,
		})
	}
}

class TeamStatusBackendStack extends Stack {
	constructor(
		parent: Construct,
		name: string,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: BackendLambdas
			layer: PackedLayer
		},
	) {
		super(parent, name)

		const isTest = this.node.tryGetContext('isTest') === '1'

		const persistence = new Persistence(this, { isTest })

		const backendLayer = new Lambda.LayerVersion(this, 'backendLayer', {
			code: Lambda.Code.fromAsset(layer.layerZipFile),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
		})

		const api = new AuthenticationAPI(this, {
			lambdaSources,
			persistence,
			layer: backendLayer,
		})

		new CfnOutput(this, 'tableName', {
			exportName: `${this.stackName}:tableName`,
			description: 'The name of the table',
			value: persistence.table.tableName,
		})

		new CfnOutput(this, 'loginRequestAPI', {
			exportName: `${this.stackName}:loginRequestAPI`,
			description: 'The API endpoint for login requests',
			value: api.loginRequestURL.url,
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
	lambdaSources: await packBackendLambdas(),
	layer: await packLayer({
		id: 'backendLayer',
		dependencies: ['@nordicsemiconductor/from-env', 'ulid', 'jsonwebtoken'],
	}),
})
