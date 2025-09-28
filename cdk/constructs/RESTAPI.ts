import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { isTest } from '@bifravst/aws-cdk-lambda-helpers/util'
import {
	Duration,
	aws_apigatewayv2 as HttpApi,
	aws_iam as IAM,
	type aws_lambda as Lambda,
	type Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../lambdas/packBackendLambdas.ts'
import { readKeyPolicy } from '../teamstatus-backend.ts'
import { ApiEmailAuthorizer, ApiUserAuthorizer } from './APIAuthorizer.ts'
import { ApiRoute } from './ApiRoute.ts'
import { CoreLambda } from './CoreLambda.ts'
import type { Events } from './Events.ts'
import type { Persistence } from './Persistence.ts'

export class RESTAPI extends Construct {
	public readonly URL: string
	constructor(
		parent: Stack,
		{
			lambdaSources,
			persistence,
			layer,
			events,
		}: {
			lambdaSources: BackendLambdas
			layer: Lambda.ILayerVersion
			persistence: Persistence
			events: Events
		},
	) {
		super(parent, 'API')

		const loginRequest = new PackedLambdaFn(
			this,
			'loginRequest',
			lambdaSources.loginRequest,
			{
				description: 'Handle login requests',
				timeout: Duration.seconds(1),
				layers: [layer],
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['ses:SendEmail'],
						resources: ['*'],
					}),
				],
				environment: {
					TABLE_NAME: persistence.table.tableName,
					TOPIC_ARN: events.topic.topicArn,
					IS_TEST: isTest(this) ? '1' : '0',
				},
			},
		).fn
		persistence.table.grantFullAccess(loginRequest)
		events.topic.grantPublish(loginRequest)

		const pinLogin = new PackedLambdaFn(
			this,
			'pinLogin',
			lambdaSources.pinLogin,
			{
				description: 'Handle logins with PINs',
				timeout: Duration.seconds(1),
				layers: [layer],
				initialPolicy: [readKeyPolicy(parent, 'privateKey')],
				environment: {
					TABLE_NAME: persistence.table.tableName,
					TOPIC_ARN: events.topic.topicArn,
				},
			},
		).fn
		persistence.table.grantFullAccess(pinLogin)
		events.topic.grantPublish(pinLogin)

		// Authorized lambdas
		const coreFunctions: Record<
			string,
			{
				routeKey: string
				description: string
				source: PackedLambda
				authContext: 'email' | 'user' | 'anon'
			}
		> = {
			me: {
				routeKey: 'GET /me',
				source: lambdaSources.me,
				description: 'Returns information about the authenticated user',
				authContext: 'email',
			},
			getUserProfile: {
				routeKey: 'GET /user/{id}',
				source: lambdaSources.getUserProfile,
				description: 'Returns the public profile of a user',
				authContext: 'user',
			},
			updateUser: {
				routeKey: 'PATCH /me',
				source: lambdaSources.updateUser,
				description: 'Updates the user profile',
				authContext: 'user',
			},
			logout: {
				routeKey: 'POST /logout',
				source: lambdaSources.logout,
				description: 'Logs the user out',
				authContext: 'email',
			},
			createUser: {
				routeKey: 'POST /me/user',
				source: lambdaSources.createUser,
				description: 'Creates a user account for the authenticated identity',
				authContext: 'email',
			},
			createOrganization: {
				routeKey: 'POST /organizations',
				source: lambdaSources.createOrganization,
				description: 'Creates a new organization',
				authContext: 'user',
			},
			listOrganizations: {
				routeKey: 'GET /organizations',
				source: lambdaSources.listOrganizations,
				description: 'Lists organizations accessible by the user',
				authContext: 'user',
			},
			updateOrganization: {
				routeKey: 'PATCH /organization/{id}',
				source: lambdaSources.updateOrganization,
				description: 'Updates an organization',
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
			createProject: {
				routeKey: 'POST /projects',
				source: lambdaSources.createProject,
				description: 'Creates a new project',
				authContext: 'user',
			},
			updateProject: {
				routeKey: 'PATCH /project/{id}',
				source: lambdaSources.updateProject,
				description: 'Updates a project',
				authContext: 'user',
			},
			deleteProject: {
				routeKey: 'DELETE /project/{id}',
				source: lambdaSources.deleteProject,
				description: 'Deletes a project',
				authContext: 'user',
			},
			listProjectMembers: {
				routeKey: 'GET /project/{id}/members',
				source: lambdaSources.listProjectMembers,
				description: 'Lists members of a project',
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
			getStatus: {
				routeKey: 'GET /project/{projectId}/status/{statusId}',
				source: lambdaSources.getStatus,
				description: 'Retrieves an individual status',
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
			listInvitations: {
				routeKey: 'GET /invitations',
				source: lambdaSources.listInvitations,
				description: 'Lists project invitations for a user',
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
			deleteSync: {
				routeKey: 'DELETE /sync/{syncId}',
				source: lambdaSources.deleteSync,
				description: 'Deletes a sync',
				authContext: 'user',
			},
			getSync: {
				routeKey: 'GET /sync/{syncId}',
				source: lambdaSources.getSync,
				description: 'Retrieve a sync',
				authContext: 'user',
			},
			listStatusInSync: {
				routeKey: 'GET /sync/{syncId}/status',
				source: lambdaSources.listStatusInSync,
				description: 'Lists status in a sync',
				authContext: 'user',
			},
			listSyncs: {
				routeKey: 'GET /syncs',
				source: lambdaSources.listSyncs,
				description: 'Lists syncs a user is participating in',
				authContext: 'user',
			},
		}

		const coreLambdas: {
			routeId: string
			fn: Lambda.IFunction
			routeKey: string
			authContext: 'email' | 'user' | 'anon'
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
					events,
				}).lambda,
				routeKey,
				authContext,
			})
		}

		const api = new HttpApi.CfnApi(this, 'api', {
			name: 'teamstatus.space API',
			protocolType: 'HTTP',
			// See https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html
			// Note: To return CORS headers, your *request* must contain an origin header. For the OPTIONS method, your *request* must contain an origin header and an Access-Control-Request-Method header.
			corsConfiguration: {
				allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
				allowOrigins: ['https://teamstatus.space', 'http://localhost:8080'],
				allowHeaders: ['Authorization', 'Content-Type', 'Accept', 'If-Match'],
				allowCredentials: true,
			},
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
		const authContextMap = {
			email: emailAuthorizer.authorizer,
			user: userAuthorizer.authorizer,
			anon: undefined,
		} as const

		const routes = [
			addRoute('loginRequestRoute', 'POST /login/email', loginRequest),
			addRoute('pinLoginRoute', 'POST /login/email/pin', pinLogin),
			...coreLambdas.map(({ routeId: id, fn, routeKey, authContext }) =>
				addRoute(id, routeKey, fn, authContextMap[authContext]),
			),
		]

		routes.map((r) => deployment.node.addDependency(r))

		this.URL = `https://${api.ref}.execute-api.${parent.region}.amazonaws.com/${stage.stageName}/`
	}
}
