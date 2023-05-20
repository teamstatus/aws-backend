import {
	App,
	CfnOutput,
	Duration,
	aws_dynamodb as DynamoDB,
	aws_apigatewayv2 as HttpApi,
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

class API extends Construct {
	public readonly api: HttpApi.CfnApi
	public readonly stage: HttpApi.CfnStage
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
		super(parent, 'API')

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
			],
			environment: {
				TABLE_NAME: persistence.table.tableName,
			},
		})
		persistence.table.grantFullAccess(loginRequest)

		const pinLogin = new Lambda.Function(this, 'pinLogin', {
			description: 'Handle logins with PINs',
			handler: lambdaSources.pinLogin.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.pinLogin.zipFile),
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			initialPolicy: [
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
		persistence.table.grantFullAccess(pinLogin)

		const apiAuthorizer = new Lambda.Function(this, 'authorizerFunction', {
			description: 'Authorize API requests',
			handler: lambdaSources.apiAuthorizer.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.apiAuthorizer.zipFile),
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ssm:GetParameter'],
					resources: [
						`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${parent.stackName}/privateKey`,
					],
				}),
			],
			environment: {
				STACK_NAME: parent.stackName,
			},
		})

		this.api = new HttpApi.CfnApi(this, 'api', {
			name: 'Teamstatus.space API',
			protocolType: 'HTTP',
			corsConfiguration: {
				allowCredentials: false,
				allowMethods: [Lambda.HttpMethod.ALL],
				maxAge: 60,
				exposeHeaders: ['Content-Type', 'Content-Length'],
				allowOrigins: ['http://localhost:8080', 'http://teamstatus.space'],
			},
		})
		this.stage = new HttpApi.CfnStage(this, 'stage', {
			apiId: this.api.ref,
			stageName: '2023-05-20',
			autoDeploy: true,
		})

		const httpApiLogGroup = new Logs.LogGroup(this, `HttpApiLogGroup`, {
			removalPolicy: RemovalPolicy.DESTROY,
			logGroupName: `/${parent.stackName}/apiAccessLogs`,
			retention:
				this.node.tryGetContext('isTest') === '1'
					? Logs.RetentionDays.ONE_DAY
					: Logs.RetentionDays.ONE_WEEK,
		})
		this.stage.accessLogSettings = {
			destinationArn: httpApiLogGroup.logGroupArn,
			format: JSON.stringify({
				requestId: '$context.requestId',
				awsEndpointRequestId: '$context.awsEndpointRequestId',
				requestTime: '$context.requestTime',
				ip: '$context.identity.sourceIp',
				protocol: '$context.protocol',
				routeKey: '$context.routeKey',
				status: '$context.status',
				responseLength: '$context.responseLength',
				integrationLatency: '$context.integrationLatency',
				integrationStatus: '$context.integrationStatus',
				integrationErrorMessage: '$context.integrationErrorMessage',
				integration: {
					status: '$context.integration.status',
				},
			}),
		}
		this.stage.node.addDependency(httpApiLogGroup)

		/*const authorizer = */ new HttpApi.CfnAuthorizer(this, 'apiAuthorizer', {
			apiId: this.api.ref,
			authorizerType: 'REQUEST',
			name: 'JwtCookieAuthorizer',
			authorizerPayloadFormatVersion: '2.0',
			authorizerUri: integrationUri(parent, apiAuthorizer),
			enableSimpleResponses: true,
			// Cannot use `authorizerResultTtlInSeconds` with Cookies, because they are not available in `identitySource`
			// authorizerResultTtlInSeconds: 300,
		})
		apiAuthorizer.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
		})

		const deployment = new HttpApi.CfnDeployment(this, 'deployment', {
			apiId: this.api.ref,
			stageName: this.stage.stageName,
		})
		deployment.node.addDependency(this.stage)

		const addRoute = (
			route: string,
			fn: Lambda.IFunction,
			authorizer?: HttpApi.CfnAuthorizer,
		) =>
			new ApiRoute(this, `${fn.node.id}Route`, {
				api: this.api,
				function: fn,
				method: route.split(' ')[0] as Lambda.HttpMethod,
				route: route.split(' ')[1] as string,
				stack: parent,
				stage: this.stage,
				authorizer,
			})

		const routes = [
			addRoute('POST /login/email', loginRequest),
			addRoute('POST /login/email/pin', pinLogin),
		]

		routes.map((r) => deployment.node.addDependency(r))
	}
}

const integrationUri = (parent: Stack, f: Lambda.IFunction) =>
	`arn:aws:apigateway:${parent.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${parent.region}:${parent.account}:function:${f.functionName}/invocations`

class ApiRoute extends Construct {
	public readonly route: HttpApi.CfnRoute
	constructor(
		parent: Construct,
		id: string,
		{
			stack,
			function: fn,
			api,
			stage,
			method,
			route,
			authorizer,
		}: {
			stack: Stack
			function: Lambda.IFunction
			api: HttpApi.CfnApi
			stage: HttpApi.CfnStage
			method: Lambda.HttpMethod
			route: string
			authorizer?: HttpApi.CfnAuthorizer
		},
	) {
		super(parent, id)

		const loginRequestIntegration = new HttpApi.CfnIntegration(
			this,
			'loginRequestIntegration',
			{
				apiId: api.ref,
				integrationType: 'AWS_PROXY',
				integrationUri: integrationUri(stack, fn),
				integrationMethod: method,
				payloadFormatVersion: '2.0',
			},
		)

		this.route = new HttpApi.CfnRoute(this, 'loginRequestRoute', {
			apiId: api.ref,
			routeKey: `${method} ${route}`,
			target: `integrations/${loginRequestIntegration.ref}`,
			authorizationType: authorizer !== undefined ? 'CUSTOM' : 'NONE',
			authorizerId: authorizer?.ref,
		})

		fn.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${api.ref}/${stage.stageName}/${method}${route}`,
		})
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

		const api = new API(this, {
			lambdaSources,
			persistence,
			layer: backendLayer,
		})

		new CfnOutput(this, 'tableName', {
			exportName: `${this.stackName}:tableName`,
			description: 'The name of the table',
			value: persistence.table.tableName,
		})

		new CfnOutput(this, 'apiURL', {
			exportName: `${this.stackName}:apiURL`,
			description: 'The API endpoint',
			value: `https://${api.api.ref}.execute-api.${this.region}.amazonaws.com/${api.stage.stageName}/`,
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
		dependencies: [
			'@nordicsemiconductor/from-env',
			'jsonwebtoken',
		],
	}),
})
