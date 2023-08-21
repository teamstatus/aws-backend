import {
	Duration,
	aws_apigatewayv2 as HttpApi,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_logs as Logs,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../lambdas/packLambdaFromPath.js'
import { readKeyPolicy } from '../teamstatus-backend.js'
import { integrationUri } from './ApiRoute.js'
import { LambdaSource } from './LambdaSource.js'

abstract class APIAuthorizer extends Construct {
	public readonly fn: Lambda.IFunction
	public readonly authorizer: HttpApi.CfnAuthorizer
	constructor(
		parent: Construct,
		id: string,
		api: HttpApi.CfnApi,
		stack: Stack,
		source: PackedLambda,
		layer: Lambda.ILayerVersion,
		description = 'Authorize API requests',
		authorizerPayloadFormatVersion: null | '2.0' = '2.0',
		environment?: Record<string, string>,
	) {
		super(parent, id)

		this.fn = new Lambda.Function(this, 'fn', {
			description,
			handler: source.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: new LambdaSource(this, source).code,
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			logRetentionRetryOptions: {
				base: Duration.millis(200),
			},
			initialPolicy: [readKeyPolicy(stack, 'publicKey')],
			environment: {
				STACK_NAME: stack.stackName,
				...(environment ?? {}),
			},
		})

		let authorizerProps: HttpApi.CfnAuthorizerProps = {
			apiId: api.ref,
			authorizerType: 'REQUEST',
			name: `${id}Authorizer`,
			authorizerUri: integrationUri(stack, this.fn),
			// Cannot use `authorizerResultTtlInSeconds` with Cookies, because they are not available in `identitySource`
			// authorizerResultTtlInSeconds: 300,
		}
		if (authorizerPayloadFormatVersion === '2.0') {
			authorizerProps = {
				...authorizerProps,
				authorizerPayloadFormatVersion,
				enableSimpleResponses: true,
			}
		}
		this.authorizer = new HttpApi.CfnAuthorizer(
			this,
			'authorizer',
			authorizerProps,
		)
		this.fn.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
		})
	}
}

export class ApiEmailAuthorizer extends APIAuthorizer {}
export class ApiUserAuthorizer extends APIAuthorizer {
	constructor(
		parent: Construct,
		id: string,
		api: HttpApi.CfnApi,
		stack: Stack,
		source: PackedLambda,
		layer: Lambda.ILayerVersion,
	) {
		super(
			parent,
			id,
			api,
			stack,
			source,
			layer,
			'Authorize API requests for active users',
			'2.0',
			{
				REQUIRE_SUB: '1',
			},
		)
	}
}

export class WSUserAuthorizer extends APIAuthorizer {
	constructor(
		parent: Construct,
		id: string,
		api: HttpApi.CfnApi,
		stack: Stack,
		source: PackedLambda,
		layer: Lambda.ILayerVersion,
	) {
		super(
			parent,
			id,
			api,
			stack,
			source,
			layer,
			'Authorize WS connections requests for active users',
			null,
		)
	}
}
