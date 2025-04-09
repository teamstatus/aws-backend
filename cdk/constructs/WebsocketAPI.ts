import {
	Duration,
	aws_dynamodb as dynamoDb,
	aws_apigatewayv2 as HttpApi,
	aws_iam as IAM,
	aws_lambda as Lambda,
	RemovalPolicy,
	type Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../lambdas/packBackendLambdas.ts'
import type { PackedLambda } from '../lambdas/packLambdaFromPath.ts'
import { WSUserAuthorizer } from './APIAuthorizer.ts'
import { integrationUri } from './ApiRoute.ts'
import { LambdaSource } from './LambdaSource.ts'

export class WebsocketAPI extends Construct {
	public readonly URL: string
	constructor(
		parent: Stack,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: BackendLambdas
			layer: Lambda.ILayerVersion
		},
	) {
		super(parent, 'WS')
		const api = new HttpApi.CfnApi(this, 'api', {
			name: 'websocketGateway',
			protocolType: 'WEBSOCKET',
			routeSelectionExpression: '$request.body.message',
		})

		const stage = new HttpApi.CfnStage(this, 'stage', {
			stageName: '2023-05-29',
			apiId: api.ref,
			autoDeploy: true,
		})

		const deployment = new HttpApi.CfnDeployment(this, 'deployment', {
			apiId: api.ref,
			stageName: stage.stageName,
		})
		deployment.node.addDependency(stage)

		const clientsTable = new dynamoDb.Table(this, 'clientsTable', {
			billingMode: dynamoDb.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'connectionId',
				type: dynamoDb.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: RemovalPolicy.DESTROY,
		})

		// Authorizer used $connect route that needs a user account
		const userAuthorizer = new WSUserAuthorizer(
			this,
			'userAuthorizer',
			api,
			parent,
			lambdaSources.wsAuthorizer,
			layer,
		)

		const addRoute = (
			routeKey: '$connect' | '$disconnect' | 'message',
			source: PackedLambda,
		) =>
			new WsapiRoute(
				api,
				stage,
				routeKey,
				parent,
				source,
				clientsTable,
				userAuthorizer.authorizer,
			)
		const routes = [
			addRoute('$connect', lambdaSources.wsOnConnect),
			addRoute('$disconnect', lambdaSources.wsOnDisconnect),
			addRoute('message', lambdaSources.wsOnMessage),
		]
		for (const route of routes) {
			deployment.node.addDependency(route)
		}

		this.URL = `wss://${api.ref}.execute-api.${parent.region}.amazonaws.com/${stage.ref}`
	}
}

class WsapiRoute extends Construct {
	public readonly fn: Lambda.IFunction
	public readonly route: HttpApi.CfnRoute
	constructor(
		api: HttpApi.CfnApi,
		stage: HttpApi.CfnStage,
		routeKey: '$connect' | '$disconnect' | 'message',
		stack: Stack,
		source: PackedLambda,
		clientsTable: dynamoDb.ITable,
		authorizer: HttpApi.CfnAuthorizer,
	) {
		super(api, routeKey)

		this.fn = new Lambda.Function(this, 'lambda', {
			handler: source.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_LATEST,
			timeout: Duration.seconds(5),
			memorySize: 1792,
			code: new LambdaSource(this, source).code,
			description: `Websocket handler for ${routeKey}`,
			environment: {
				CONNECTIONS_TABLE_NAME: clientsTable.tableName,
			},
		})
		clientsTable.grantWriteData(this.fn)

		this.fn.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${api.ref}/${stage.stageName}/${routeKey}`,
		})

		const integration = new HttpApi.CfnIntegration(this, 'integration', {
			apiId: api.ref,
			description: `${routeKey} integration`,
			integrationType: 'AWS_PROXY',
			integrationUri: integrationUri(stack, this.fn),
		})
		this.route = new HttpApi.CfnRoute(this, 'route', {
			apiId: api.ref,
			routeKey,
			target: `integrations/${integration.ref}`,
			...(routeKey === '$connect'
				? { authorizationType: 'CUSTOM', authorizerId: authorizer.ref }
				: {
						authorizationType: 'NONE',
					}),
		})
	}
}
