import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import type { EmailAuthContext, UserAuthContext } from '../core/auth'

export const handler = async (
	event: APIGatewayProxyEventV2 & {
		requestContext: APIGatewayProxyEventV2['requestContext'] & {
			authorizer: {
				lambda: EmailAuthContext | UserAuthContext
			}
		}
	},
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event }))

	return {
		statusCode: 200,
		headers: {
			'Content-type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify(event.requestContext.authorizer.lambda),
	}
}
