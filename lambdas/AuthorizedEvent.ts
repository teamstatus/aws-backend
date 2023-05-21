import type { APIGatewayProxyEventV2 } from 'aws-lambda'

export type AuthorizedEvent<Context> = APIGatewayProxyEventV2 & {
	requestContext: APIGatewayProxyEventV2['requestContext'] & {
		authorizer: {
			lambda: Context
		}
	}
}
