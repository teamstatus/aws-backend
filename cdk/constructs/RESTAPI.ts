import {
	Duration,
	aws_apigatewayv2 as HttpApi,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_logs as Logs,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { type BackendLambdas } from '../lambdas/packBackendLambdas.js'
import type { PackedLambda } from '../lambdas/packLambdaFromPath.js'
import { readKeyPolicy } from '../teamstatus-backend.js'
import { ApiEmailAuthorizer, ApiUserAuthorizer } from './APIAuthorizer.js'
import { ApiRoute } from './ApiRoute.js'
import { CoreLambda } from './CoreLambda.js'
import { Persistence } from './Persistence.js'
import type { WebsocketAPI } from './WebsocketAPI.js'

export class RESTAPI extends Construct {
	public readonly URL: string
	constructor(
		parent: Stack,
		{
			lambdaSources,
			persistence,
			layer,
			ws,
		}: {
			lambdaSources: BackendLambdas
			layer: Lambda.ILayerVersion
			persistence: Persistence
			ws: WebsocketAPI
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
				WS_URL: ws.URL,
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
				routeKey: 'GET /projects',
				source: lambdaSources.listProjects,
				description: 'Lists projects accessible by the user',
				authContext: 'user',
			},
			listOrganizationProjects: {
				routeKey: 'GET /organization/{organizationId}/projects',
				source: lambdaSources.listOrganizationProjects,
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
				routeKey: 'POST /project/{projectId}/invitation',
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
			deleteReaction: {
				routeKey: 'DELETE /reaction/{reactionId}',
				source: lambdaSources.deleteReaction,
				description: 'Deletes a reaction',
				authContext: 'user',
			},
			createSync: {
				routeKey: 'POST /sync',
				source: lambdaSources.createSync,
				description: 'Creates a new sync',
				authContext: 'user',
			},
			listStatusInSync: {
				routeKey: 'GET /sync/{syncId|/status',
				source: lambdaSources.listStatusInSync,
				description: 'Lists status in a sync',
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
					ws,
				}).lambda,
				routeKey,
				authContext,
			})
		}

		const api = new HttpApi.CfnApi(this, 'api', {
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

		const stage = new HttpApi.CfnStage(this, 'stage', {
			apiId: api.ref,
			stageName: '2023-05-20',
			autoDeploy: true,
		})

		const deployment = new HttpApi.CfnDeployment(this, 'deployment', {
			apiId: api.ref,
			stageName: stage.stageName,
		})
		deployment.node.addDependency(stage)

		// Authorizer used for actions that only need a logged in user
		const emailAuthorizer = new ApiEmailAuthorizer(
			this,
			'emailAuthorizer',
			api,
			parent,
			lambdaSources.apiAuthorizer,
			layer,
		)
		// Authorizer used for actions that need a user account
		const userAuthorizer = new ApiUserAuthorizer(
			this,
			'userAuthorizer',
			api,
			parent,
			lambdaSources.apiAuthorizer,
			layer,
		)

		const addRoute = (
			id: string,
			route: string,
			fn: Lambda.IFunction,
			authorizer?: HttpApi.CfnAuthorizer,
		) =>
			new ApiRoute(this, id, {
				api,
				function: fn,
				method: route.split(' ')[0] as Lambda.HttpMethod,
				route: route.split(' ')[1] as string,
				stack: parent,
				stage,
				authorizer,
			})
		const addCors = (path: string) =>
			new ApiRoute(this, `${path.slice(1).replaceAll('/', '_')}CORS`, {
				api,
				function: cors,
				method: Lambda.HttpMethod.OPTIONS,
				route: path,
				stack: parent,
				stage,
			})

		const routes = [
			addRoute('loginRequestRoute', 'POST /login/email', loginRequest),
			addRoute('pinLoginRoute', 'POST /login/email/pin', pinLogin),
			...coreLambdas.map(({ routeId: id, fn, routeKey, authContext }) =>
				addRoute(
					id,
					routeKey,
					fn,
					authContext === 'email'
						? emailAuthorizer.authorizer
						: userAuthorizer.authorizer,
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

		this.URL = `https://${api.ref}.execute-api.${parent.region}.amazonaws.com/${stage.stageName}/`
	}
}
