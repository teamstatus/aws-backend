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
import { indexes } from '../core/persistence/db.js'
import {
	packBackendLambdas,
	type BackendLambdas,
} from './lambdas/packBackendLambdas.js'
import type { PackedLambda } from './lambdas/packLambdaFromPath.js'
import type { PackedLayer } from './lambdas/packLayer.js'
import { packLayer } from './lambdas/packLayer.js'

const readKeyPolicy = (stack: Stack, type: 'privateKey' | 'publicKey') =>
	new IAM.PolicyStatement({
		actions: ['ssm:GetParameter'],
		resources: [
			`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/${type}`,
		],
	})

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
			initialPolicy: [readKeyPolicy(parent, 'privateKey')],
			environment: {
				STACK_NAME: parent.stackName,
				TABLE_NAME: persistence.table.tableName,
			},
		})
		persistence.table.grantFullAccess(pinLogin)

		// Authorized lambdas
		const coreFunctions: Record<
			string,
			{
				routeKey: string
				description: string
				source: PackedLambda
				authContext: 'email' | 'user'
			}
		> = {
			me: {
				routeKey: 'GET /me',
				source: lambdaSources.me,
				description: 'Returns information about the authenticated user',
				authContext: 'email',
			},
			createUser: {
				routeKey: 'PUT /me/user',
				source: lambdaSources.createUser,
				description: 'Creates a user account for the authenticated identity',
				authContext: 'email',
			},
			listOrganizations: {
				routeKey: 'GET /organizations',
				source: lambdaSources.listOrganizations,
				description: 'Lists organizations accessible by the user',
				authContext: 'user',
			},
			listProjects: {
				routeKey: 'GET /organization/{organizationId}/projects',
				source: lambdaSources.listProjects,
				description: 'Lists projects accessible by the user',
				authContext: 'user',
			},
			createOrganization: {
				routeKey: 'POST /organizations',
				source: lambdaSources.createOrganization,
				description: 'Creates a new organization',
				authContext: 'user',
			},
			createProject: {
				routeKey: 'POST /projects',
				source: lambdaSources.createProject,
				description: 'Creates a new project',
				authContext: 'user',
			},
			createStatus: {
				routeKey: 'POST /project/{projectId}/status',
				source: lambdaSources.createStatus,
				description: 'Creates a new status',
				authContext: 'user',
			},
			listStatus: {
				routeKey: 'GET /project/{projectId}/status',
				source: lambdaSources.listStatus,
				description: 'Lists status accessible by the user',
				authContext: 'user',
			},
			createReaction: {
				routeKey: 'POST /status/{statusId}/reaction',
				source: lambdaSources.createReaction,
				description: 'Creates a new reaction',
				authContext: 'user',
			},
			deleteStatus: {
				routeKey: 'DELETE /status/{statusId}',
				source: lambdaSources.deleteStatus,
				description: 'Deletes a status',
				authContext: 'user',
			},
			inviteToProject: {
				routeKey: 'POST /project/{projectId}/member',
				source: lambdaSources.inviteToProject,
				description: 'Invites a user to a project',
				authContext: 'user',
			},
			acceptProjectInvitation: {
				routeKey: 'POST /project/{{projectId}}/invitation',
				source: lambdaSources.acceptProjectInvitation,
				description: 'Accepts a project invitation',
				authContext: 'user',
			},
			createToken: {
				routeKey: 'POST /me/token',
				source: lambdaSources.createToken,
				description: 'Generates a new token',
				authContext: 'user',
			},
			updateStatus: {
				routeKey: 'PATCH /status/{statusId}',
				source: lambdaSources.updateStatus,
				description: 'Updates a status',
				authContext: 'user',
			},
		}

		const coreLambdas: {
			routeId: string
			fn: Lambda.IFunction
			routeKey: string
			authContext: 'email' | 'user'
		}[] = []
		for (const [
			id,
			{ source, description, routeKey, authContext },
		] of Object.entries(coreFunctions)) {
			coreLambdas.push({
				routeId: `${id}Route`,
				fn: new CoreLambda(this, id, {
					stack: parent,
					description,
					layer,
					persistence,
					source,
				}).lambda,
				routeKey,
				authContext,
			})
		}

		const apiAuthorizerProps: Lambda.FunctionProps = {
			description: 'Authorize API requests',
			handler: lambdaSources.apiAuthorizer.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.apiAuthorizer.zipFile),
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			initialPolicy: [readKeyPolicy(parent, 'publicKey')],
			environment: {
				STACK_NAME: parent.stackName,
			},
		}
		const apiEmailAuthorizer = new Lambda.Function(
			this,
			'apiEmailAuthorizerFunction',
			apiAuthorizerProps,
		)
		const apiUserAuthorizer = new Lambda.Function(
			this,
			'apiUserAuthorizerFunction',
			{
				...apiAuthorizerProps,
				description: 'Authorize API requests for active users',
				environment: {
					...apiAuthorizerProps.environment,
					REQUIRE_SUB: '1',
				},
			},
		)

		this.api = new HttpApi.CfnApi(this, 'api', {
			name: 'Teamstatus.space API',
			protocolType: 'HTTP',
			// This has no effect, maybe a bug?
			/*
			corsConfiguration: {
				allowCredentials: true,
				allowMethods: [Lambda.HttpMethod.ALL],
				maxAge: 60,
				exposeHeaders: ['Content-Type', 'Content-Length', 'Content-Language'],
				allowOrigins: ['http://localhost:8080', 'http://teamstatus.space'],
			},
			*/
		})
		// Use a lambda to send CORS headers
		const cors = new Lambda.Function(this, 'cors', {
			description: 'Send CORS headers',
			handler: lambdaSources.cors.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 256,
			code: Lambda.Code.fromAsset(lambdaSources.cors.zipFile),
			logRetention: Logs.RetentionDays.ONE_DAY,
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

		// Authorizer used for actions that only need a logged in user
		const emailAuthorizer = new HttpApi.CfnAuthorizer(
			this,
			'apiEmailAuthorizer',
			{
				apiId: this.api.ref,
				authorizerType: 'REQUEST',
				name: 'JwtCookieEmailAuthorizer',
				authorizerPayloadFormatVersion: '2.0',
				authorizerUri: integrationUri(parent, apiEmailAuthorizer),
				enableSimpleResponses: true,
				// Cannot use `authorizerResultTtlInSeconds` with Cookies, because they are not available in `identitySource`
				// authorizerResultTtlInSeconds: 300,
			},
		)
		apiEmailAuthorizer.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
		})

		// Authorizer used for actions that need a user account
		const userAuthorizer = new HttpApi.CfnAuthorizer(
			this,
			'apiUserAuthorizer',
			{
				apiId: this.api.ref,
				authorizerType: 'REQUEST',
				name: 'JwtUserCookieAuthorizer',
				authorizerPayloadFormatVersion: '2.0',
				authorizerUri: integrationUri(parent, apiUserAuthorizer),
				enableSimpleResponses: true,
			},
		)
		apiUserAuthorizer.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
		})

		const deployment = new HttpApi.CfnDeployment(this, 'deployment', {
			apiId: this.api.ref,
			stageName: this.stage.stageName,
		})
		deployment.node.addDependency(this.stage)

		const addRoute = (
			id: string,
			route: string,
			fn: Lambda.IFunction,
			authorizer?: HttpApi.CfnAuthorizer,
		) =>
			new ApiRoute(this, id, {
				api: this.api,
				function: fn,
				method: route.split(' ')[0] as Lambda.HttpMethod,
				route: route.split(' ')[1] as string,
				stack: parent,
				stage: this.stage,
				authorizer,
			})
		const addCors = (path: string) =>
			new ApiRoute(this, `${path.slice(1).replaceAll('/', '_')}CORS`, {
				api: this.api,
				function: cors,
				method: Lambda.HttpMethod.OPTIONS,
				route: path,
				stack: parent,
				stage: this.stage,
			})
		const routes = [
			addRoute('loginRequestRoute', 'POST /login/email', loginRequest),
			addRoute('pinLoginRoute', 'POST /login/email/pin', pinLogin),
			...coreLambdas.map(({ routeId: id, fn, routeKey, authContext }) =>
				addRoute(
					id,
					routeKey,
					fn,
					authContext === 'email' ? emailAuthorizer : userAuthorizer,
				),
			),
			// CORS
			addCors('/login/email'),
			addCors('/login/email/pin'),
			...[
				...new Set(
					coreLambdas.map(({ routeKey }) => routeKey.split(' ')[1] as string),
				),
			].map((path) => addCors(path)),
		]

		routes.map((r) => deployment.node.addDependency(r))
	}
}

class CoreLambda extends Construct {
	public readonly lambda: Lambda.Function
	constructor(
		parent: Construct,
		id: string,
		{
			stack,
			description,
			source,
			layer,
			persistence,
		}: {
			stack: Stack
			description: string
			source: PackedLambda
			layer: Lambda.ILayerVersion
			persistence: Persistence
			environment?: Record<string, string>
		},
	) {
		super(parent, id)

		this.lambda = new Lambda.Function(this, 'FN', {
			description,
			handler: source.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(source.zipFile),
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			initialPolicy: [
				readKeyPolicy(stack, 'privateKey'),
				readKeyPolicy(stack, 'publicKey'),
			],
			environment: {
				TABLE_NAME: persistence.table.tableName,
				STACK_NAME: stack.stackName,
			},
		})
		persistence.table.grantFullAccess(this.lambda)
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

		const integration = new HttpApi.CfnIntegration(this, 'Integration', {
			apiId: api.ref,
			integrationType: 'AWS_PROXY',
			integrationUri: integrationUri(stack, fn),
			integrationMethod: 'POST',
			payloadFormatVersion: '2.0',
		})

		this.route = new HttpApi.CfnRoute(this, `Route`, {
			apiId: api.ref,
			routeKey: `${method} ${route}`,
			target: `integrations/${integration.ref}`,
			authorizationType: authorizer !== undefined ? 'CUSTOM' : 'NONE',
			authorizerId: authorizer?.ref,
		})

		fn.addPermission(
			`invokeByHttpApi-${method}-${route.slice(1).replaceAll('/', '_')}`,
			{
				principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
				sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${api.ref}/${stage.stageName}/${method}${route}`,
			},
		)
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
		dependencies: ['@nordicsemiconductor/from-env', 'jsonwebtoken', 'ulid'],
	}),
})
