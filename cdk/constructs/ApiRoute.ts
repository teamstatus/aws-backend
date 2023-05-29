import {
	aws_apigatewayv2 as HttpApi,
	aws_iam as IAM,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export const integrationUri = (parent: Stack, f: Lambda.IFunction): string =>
	`arn:aws:apigateway:${parent.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${parent.region}:${parent.account}:function:${f.functionName}/invocations`

export class ApiRoute extends Construct {
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
