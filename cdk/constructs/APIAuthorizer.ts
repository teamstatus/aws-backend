import {
	Duration,
	aws_apigatewayv2 as HttpApi,
	aws_iam as IAM,
	aws_lambda as Lambda,
	type Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { readKeyPolicy } from '../teamstatus-backend.ts'
import { integrationUri } from './ApiRoute.ts'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'

abstract class ApiAuthorizer extends Construct {
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

		this.fn = new PackedLambdaFn(this, 'fn', source, {
			description,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_22_X,
			timeout: Duration.seconds(1),
			layers: [layer],
			initialPolicy: [readKeyPolicy(stack, 'publicKey')],
			environment,
		}).fn

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

export class ApiEmailAuthorizer extends ApiAuthorizer {}
export class ApiUserAuthorizer extends ApiAuthorizer {
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

export class WSUserAuthorizer extends ApiAuthorizer {
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
